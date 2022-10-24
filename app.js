
const nodemailer = require('nodemailer');
const mysql = require('mysql2');
const mysqlx = require('@mysql/xdevapi');
const fs = require('fs');
const cryptojs = require('crypto-js');
const util = require('util');
const { homeURL, socketURL, wwwURL, server, dbURL, dbPort, sqlCred, emailUser, emailPassword, authToken } = require('./httpVars');



const adminAddress = emailUser;


const io = require('socket.io')(server, {
    cors: {
        origin: [homeURL, wwwURL,socketURL ],
    },
    
});


server.listen(54944);

const dice = [
    { diceID: 1, diceMax: 4 },
    { diceID: 2, diceMax: 6 },
    { diceID: 3, diceMax: 8 },
    { diceID: 4, diceMax: 10 },
    { diceID: 5, diceMax: 12 },
    { diceID: 6, diceMax: 20 },
    { diceID: 7, diceMax: 100 },

]

function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    } return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}
function sfc32(a, b, c, d) {
    return function () {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        var t = (a + b) | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        d = d + 1 | 0;
        t = t + d | 0;
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    }
}

function getRandomInt(min, max, seed) {
    min = Math.ceil(min);
    max = Math.floor(max);
    const rand = sfc32(seed(), seed(), seed(), seed())();

    return Math.floor(rand * (max - min + 1)) + min;
}



let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
        user: emailUser,
        pass: emailPassword
    },
  
});






let sqlCredentials = sqlCred;

var mySession = mysqlx.getSession(sqlCredentials);

mySession.catch((reason) => {
    console.log(reason)
})


const pingAlive = () =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const pingQuery = "\
UPDATE \
 arcturus.keepalive \
SET \
 keepalive.keepAliveValue = 1 \
WHERE \
 keepalive.keepAliveID =  1";

    mySession.then((mySession) => {
        mySession.sql(pingQuery).execute().then((result) => {
           
            console.log("ping")
        })
    })
    setTimeout(pingAlive, 30000 );
}

pingAlive();


io.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
});

const status = {
    valid:1,
    invalid:2,
    confirming:3,
    Offline:4, 
    Online: 5,
    rejected:6,
    accepted:7
}

io.on('connection', (socket) =>{
    const id = socket.id;
    let user = null;
    if (socket.handshake.auth.token != authToken)
    {
        console.log("wrong token")
     
        socket.disconnect(true);
        
    }else{
        if (socket.handshake.auth.user.nameEmail == 'anonymous')
        {
            console.log("anonymous")
            socket.on('createUser', (user, userCreated) => {
                createUser(user, (results) => {
                    userCreated(results);
                });
            });


            socket.on('checkUserName', (userName, check) => {
                console.log('checkUserName:' + userName);
                checkUserName(userName, (results) => {
                    check(results)
                });
            });

            socket.on('checkEmail', (userEmail, check) => {
                console.log('checkUserEmail:' + userEmail);
                checkEmail(userEmail, (results) => {
                    check(results)
                });
            });

            socket.on('validateEmail', (userEmail, status, code, check) => {
                console.log('checkUserEmail:' + userEmail);
                validateEmail(userEmail, code, (results) => {
                    check(results)
                });
            });
            
            socket.on('checkRefCode', (code, returnID) => {
                console.log('checkRefCode: ' + code);
                checkReferral(code, (results) => {
                    returnID(results);
                })
            });
            socket.on("sendRecoveryEmail", (email,callback)=>{
                sendRecoveryEmail(email, (sent) =>{
                    callback(sent)
                })
            })
            socket.on("updateUserPassword", (info, callback)=>{
                updateUserPassword(info, (result)=>{
                    callback(result)
                })
            })
        }else{
            checkUser(socket.handshake.auth.user, ( success, loginUser) => {
                
                if(success)
                {
                    user = loginUser;
                    user["loggedIn"] = true;
                    console.log(user)
                    getContacts(user, (contacts) => {
                        getContactRequests(user, (requests => {
                            io.to(id).emit("loggedIn", loginUser, contacts, requests)
                        }))
                    })
                    updateUserStatus(user.userID, status.Online, id, (isRooms, rooms)=>{
                        if (isRooms) {
                            for (let i = 0; i < rooms.length; i++) {
                                
                                console.log("sending userStatus message to: " + rooms[i][0] + " user: " + user.userID + " is: Online");
                                
                                io.to(rooms[i][0]).emit("userStatus", user.userID, user.userName, "Online");

                            }
                        }
                     
                    })
                    
                    
/* //////////////SUCCESS///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/

                    socket.on("requestContact", (contactID, msg, callback)=>{
                        const userID = user.userID;
                        requestContact(userID, contactID, msg, (result)=>{
                            const contactSocketID = result.socketID
                            if(contactSocketID != ""){
                                io.to(contactSocketID).emit("requestContact", userID, msg)
                            } 
                            callback(result)
                        })
                    })

                    socket.on("acknowledgeContact", (response, contactID, callback) =>{
                        const userID = user.userID;
                        const socketID = id;
                        
                        acknowledgeContact(userID, response, contactID, (result)=>{
                            const success = result.success;
                     
                            if (success){
                                const contactSocket = result.contactSocket;
                                const contactOnline = (result.contactStatusID == status.Online);

                                if(contactOnline && contactSocket != ""){
                                   
                                    if(response){
                                        io.to(contactSocket).emit("acknowledgeContact", { accepted: response, socket: socketID, userID: userID })
                                        callback({success: true, socket: contactSocket, online: contactOnline})
                                    }else{
                                        io.to(contactSocket).emit("acknowledgeContact", { accepted: response, userID: userID })
                                        callback({ success: true })
                                    }
                                }else{
                                    callback({success: true, contactOnline: false, socket:"" })
                                }
                            }else{
                                callback(result)
                            }
                        })
                    })

                    socket.on('createRefCode', (code, callback)=>{
                        createRefCode(user, code, (created, result)=>{
                            callback(created, result)
                        })
                    })

                    socket.on("getUserReferalCodes", (callback)=>{
                        getUserReferalCodes(user, (result)=>{
                            callback(result)
                        })
                    })

                    socket.on('getUserInformation', (userInformation) => {
                        console.log(user)
                        if (user != null) {
                            getUserInformation(user, (info) => {
                                userInformation(info);
                            })
                        }
                    })



                    socket.on("updateSocketID", (userID) => {
                        updateSocketID(userID, id);
                    })


                    socket.on('searchPeople', (text, userID, returnPeople) => {
                        console.log('searchPeople:' + text);
                        findPeople(text, userID, (results) => {
                            returnPeople(results)
                        });
                    });

               

                    socket.on('joinRoom', (room, userID, userName, returnJoined) => {
                        console.log("Joining room " + room);
                        socket.join(room)
                        setUserRoomStatus(room, userID, "Online", (statusUpdated) => {

                            if (statusUpdated > 0) {
                                console.log("sending:userRoomStatus(" + room + "):" + userID + " : " + "Online");
                                io.to(room).emit("userRoomStatus", userID, userName, "Online");
                                getRoomUsers(room, userID, (users) => {
                                    getStoredMessages(room, (messages) => {
                                        returnJoined(true, users, messages);
                                    });
                                });

                            } else {
                                returnJoined(false, [], []);
                            }
                        })

                    });

                    socket.on('leaveRoom', (room, userID, userName, returnLeave) => {
                        socket.leave(room)
                        console.log("leaving room: " + room)
                        returnLeave(true);
                        setUserRoomStatus(room, userID, "Offline", (statusUpdated) => {
                            if (statusUpdated > 0) {
                                console.log("sending:userRoomStatus(" + room + "):" + userID + " : " + "Offline");
                                io.to(room).emit("userRoomStatus", userID, userName, "Offline");

                            }
                        })

                    });

                    socket.on('disconnect', () => {
                        const userName = user.userName;
                        const userID = user.userID;
                        if (userID > 0) {
                            cleanRooms(userID, (roomCount) => {
                                console.log("cleaned " + roomCount + " rooms, disconnecting user...");
                            });
                            updateUserStatus(userID, status.Offline, "", (isRooms, rooms) => {
                                if (isRooms) {
                                    for (let i = 0; i < rooms.length; i++) {
                                        console.log("sending userStatus message to: " + rooms[i][0] + " user: " + userID + " is: Offline");
                                        io.to(rooms[i][0]).emit("userStatus", userID, userName, "Offline");

                                    }
                                }
                            });
                        }
                        
                    });

                    socket.on("sendCampMsg", (room = "", userName = "", userID = 0, type = 0, msg = "", sent) => {
                        console.log("emiting to:" + room + " username: " + userName + " type: " + type + " msg: " + msg);
                        io.to(room).emit("campMsg", userName, type, msg);

                        storeMessage(room, userID, type, msg, (results) => {

                            console.log("stored: " + results);

                            sent(true, results);
                        })

                    })

                    socket.on("newCampaign", (userID = -1, campaignName = "", imgFile = "", status = "", callback) => {
                        console.log("Create new campaign: " + userID + ":" + campaignName);
                        createCampaign(userID, campaignName, imgFile, status, (result) => {
                            callback(result);
                        })
                    });

                    socket.on("getImage", (imageID = -1, callback) => {
                        console.log("getting Image: " + imageID);
                        getImage(imageID, callback);
                    });

                    socket.on("searchCampaigns", (text, userID, callback) => {
                        console.log("Searching Campaigns for ")
                        searchCampaigns(text, userID, callback);
                    });

                    socket.on("addUserToRoom", (userID, roomID, callback) => {
                        console.log("adding user : " + userID + " to room: " + roomID);

                        addUserToRoom(userID, roomID, callback);
                    })

                    socket.on("joinCampaign", (userID, userName, campaignID, roomID, callback) => {
                        console.log("user: " + userID + "joining:" + campaignID)
                        createCampaignUser(userID, campaignID, (inserted) => {
                            if (inserted > 0) {
                                addUserToRoom(userID, roomID, (insertedIntoRoom) => {
                                    if (insertedIntoRoom) {
                                        const campaignUser = [userID, userName, "Online", "Offline", "", 0, 0, 0]
                                        io.to(roomID).emit("newCampaignUser", campaignUser);
                                        callback(insertedIntoRoom);
                                    } else {
                                        console.log("Couldn't add campaign user " + userID + " to room " + roomID + " cleanup required");
                                        callback(0);
                                    }

                                });
                            } else {
                                callback(0)
                            }
                        });
                    });

                    socket.on("roomStream", (userID, userName, roomID, options, callback) => {
                        console.log("user " + userID + " streaming");


                        io.to(roomID).emit("newStream", userID, userName, options);
                        updateUserRoom(userID, roomID, options, (userRoomUpdated) => {
                            callback(userRoomUpdated);
                        })

                    })

                    /*  socket.on("getCharacters", (returnCharacters)=>{
                          console.log("getting characters");
                  
                          getCharacters((characters)=>{
                              returnCharacters(characters);
                          })
                      })*/

                    socket.on("addCharacter", (character, wasInserted) => {
                        console.log("adding character");

                        addCharacter(character, (inserted) => {
                            wasInserted(inserted);
                        })
                    })
                    socket.on("addObject", (object, wasInserted) => {
                        console.log("adding object");

                        addObject(object, (inserted) => {
                            wasInserted(inserted);
                        })
                    })
                    socket.on("updateCharacterObject", (characterID, objectID, wasInserted) => {
                        updateCharacterObject(characterID, objectID, (affected) => {
                            wasInserted(affected);
                        })
                    })
                    socket.on("updateCharacter", (characterID, characterName, raceID, classID, playable, characterImageUrl, currentObjectID, objectName, objectUrl, objectColor, objectTextureUrl, isUpdated) => {
                        updateCharacter(characterID, characterName, raceID, classID, playable, characterImageUrl, currentObjectID, objectName, objectUrl, objectColor, objectTextureUrl, (updated) => {
                            isUpdated(updated)
                        })
                    })

                    socket.on("getRaceNames", (callback) => {
                        getRaceNames((races) => {
                            callback(races);
                        })
                    })
                    socket.on("getClassNames", (callback) => {
                        getClassNames((classes) => {
                            callback(classes);
                        })
                    })

                    socket.on("getCharacters", (playable, callback) => {
                        getCharacters(playable, (characterArray) => {
                            getRaceNames((raceArray) => {
                                getClassNames((classArray) => {
                                    callback(raceArray, classArray, characterArray);
                                })
                            })
                        })

                    })

                    socket.on("editMonsters", (callback) => {
                        getMonsters((monsterArray) => {
                            console.log(monsterArray)
                            getSizes((sizeArray) => {
                                getMonsterTypes((typeArray) => {
                                    getAllMonsterSubTypes((subTypeArray) => {
                                        getSkills((skillArray) => {
                                            getSenses((senseArray) => {
                                                getLanguages((languageArray) => {
                                                    getTraits((traitArray) => {
                                                        getMonsterActions((actionArray) => {
                                                            callback(monsterArray, sizeArray, typeArray, subTypeArray, skillArray, senseArray, languageArray, traitArray, actionArray);
                                                        })
                                                    })
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })

                    socket.on("addMonster", (monster, wasInserted) => {
                        console.log("adding monster");

                        addMonster(monster, (insertedID) => {
                            wasInserted(insertedID);
                        })
                    })

                    socket.on("updateMonster", (monster, wasUpdated) => {
                        console.log("updating monster");

                        updateMonster(monster, (boolean) => {
                            wasUpdated(boolean);
                        })
                    })

                    socket.on("addMonsterObject", (monsterID, objectID, wasInserted) => {
                        addMonsterObject(monsterID, objectID, (affected) => {
                            wasInserted(affected);
                        })
                    })
                    //socket.broadcast.emit
                    //socket.to(id).emit
                    //socket.join("text")


                    socket.on('joinCampaignRoom', (roomID, campaignID, userID, isAdmin, userName, returnJoined) => {
                        console.log("Joining room " + roomID);
                        socket.join(roomID)
                        setUserRoomStatus(roomID, userID, "Online", (statusUpdated) => {

                            if (statusUpdated > 0) {
                                console.log("sending:userRoomStatus(" + roomID + "):" + userID + " : " + "Online");
                                io.to(roomID).emit("userRoomStatus", userID, userName, "Online");
                                getRoomUsers(roomID, userID, (users) => {
                                    getStoredMessages(roomID, (messages) => {
                                        getCurrentScene(campaignID, isAdmin, userID, (scene) => {


                                            returnJoined(true, users, messages, scene);

                                        });
                                    });
                                });

                            } else {
                                returnJoined(false, [], []);
                            }
                        })

                    });

                    socket.on("getSceneAssets", (sceneID, userID, campaignID, callback) => {
                        getCampaignUserPC(userID, campaignID, (PC) => {
                            getParty(userID, campaignID, (party) => {
                                getSceneMonsters(sceneID, (monsters) => {
                                    getScenePlaceables(sceneID, (placeables) => {
                                        callback(PC, party, monsters, placeables)
                                    });
                                });
                            });
                        });
                    })

                    socket.on("setPC", (userID, campaignID, roomID, PC, callbackID) => {

                        setPC(userID, campaignID, PC, (PCID) => {
                            if (PCID > 0) {
                                PC.PCID = PCID;
                                PC.userID = userID;
                                io.to(roomID).emit("newPC", PC)
                            }
                            callbackID(PCID);
                        })
                    })

                    socket.on("getSceneAttributes", (callback) => {
                        getSceneSettings((settings) => {
                            getTextures(1, (textures) => {
                                callback(settings, textures);
                            })
                        })

                    })
                    socket.on("addCampaignScene", (campaignID, roomID, scene, callback) => {
                        addCampaignScene(campaignID, roomID, scene, (sceneID, terrainID) => {
                            if (sceneID > 0) {

                                callback(sceneID, terrainID);

                            } else {
                                callback(false, false);
                            }
                        })
                    })

                    socket.on("getScenes", (campaignID, callback) => {
                        getCampaignScenes(campaignID, (scenes) => {
                            callback(scenes);
                        })
                    })

                    socket.on("setCampaignScene", (campaignID, sceneID, callback) => {

                        setCampaignScene(campaignID, sceneID, (set) => {

                            callback(set);
                        })

                    })

                    socket.on("removeScene", (campaignID, roomID, sceneID, callback) => {
                        setCampaignScene(campaignID, null, (set) => {
                            if (set) {
                                removeScene(sceneID, (removed) => {
                                    io.to(roomID).emit("campaignSceneChanged", { sceneID: -1, prevID: sceneID });
                                    callback(removed);
                                })

                            }
                        })


                    })

                    socket.on("noScene", (campaignID, roomID) => {
                        setCampaignScene(campaignID, null, (set) => {
                            if (set) io.to(roomID).emit("campaignSceneChanged", { sceneID: -1, prevID: -1 });
                        })
                    })

                    socket.on("PCscenePosition", (roomID, PCID, sceneID, position) => {

                        io.to(roomID).emit("PCscenePosition", PCID, sceneID, position)
                        setPCscenePosition(PCID, sceneID, position);
                    })

                    socket.on("monsterScenePosition", (roomID, monsterSceneID, position) => {
                        io.to(roomID).emit("monsterScenePosition", monsterSceneID, position)
                        setMonsterScenePosition(monsterSceneID, position);
                    })


                    socket.on("leaveScene", (roomID, PCID, sceneID) => {
                        console.log("leaving scene (PCID:sceneID): " + PCID + " : " + sceneID);
                        io.to(roomID).emit("leaveScene", PCID, sceneID)
                        leaveScene(PCID, sceneID, (left) => {

                        });
                    })

                    socket.on("endScene", (roomID, sceneID, callback) => {
                        io.to(roomID)("endScene", sceneID);
                        endScene(sceneID, (ended) => {
                            callback(ended);
                        });
                    })
                    socket.on("getMonsterTypes", (callback) => {
                        getMonsterTypes((types) => {
                            callback(types);
                        })
                    })

                    socket.on("findMonsters", (searchText, monsterTypeID, monsterSubTypeID, callback) => {
                        findMonsters(searchText, monsterTypeID, monsterSubTypeID, (monsters) => {
                            callback(monsters);
                        })
                    })

                    socket.on("addMonsterScene", (monster, count, random, idCallback) => {

                        let diceMax = 0;
                        let max = 0;
                        let min = 0;
                        const diceID = monster.dice.diceID;
                        const diceMultiplier = monster.dice.diceMultiplier;
                        const diceModifier = monster.dice.diceModifier;

                        if (random) {
                            for (let index = 0; index < dice.length; index++) {
                                if (diceID == dice[index].diceID) diceMax = dice[index].diceMax;
                            }
                            max = (diceMax * diceMultiplier) + diceModifier;
                            min = diceModifier + diceMultiplier;

                        }
                        var str = new Date().toString();

                        var seed = xmur3(str);
                        function loop(i, arr, c) {

                            if (i < c) {
                                var monsterClone = structuredClone(monster);

                                if (random) monsterClone.HP = getRandomInt(min, max, seed);

                                addMonsterScene(monsterClone, (monsterSceneID) => {


                                    monsterClone.monsterSceneID = monsterSceneID;
                                    arr.push(monsterClone)
                                    i++;
                                    loop(i, arr, c);
                                })

                            } else {
                                idCallback(arr);
                            }
                        }
                        loop(0, [], count);
                    })

                    socket.on("removeSceneMonster", (roomID, monsterSceneID) => {
                        console.log("remove monsterScene " + monsterSceneID)
                        io.to(roomID).emit("removeMonsterScene", monsterSceneID)
                        removeSceneMonster(monsterSceneID);
                    })

                    socket.on("updateMonsterScene", (roomID, monster) => {
                        console.log("updating mosnterScene " + monster.monsterSceneID)
                        io.to(roomID).emit("updateMonsterScene", monster);

                        updateMonsterScene(monster);
                    })

                    socket.on("getMonsterAttributes", (callback) => {
                        getMonsterTypes((types) => {
                            getAllMonsterSubTypes((subTypes) => {
                                getSizes((sizes) => {
                                    callback(types, subTypes, sizes);
                                })
                            })
                        })


                    })

                    socket.on("addPlaceableType", (typeName, callback) => {
                        console.log("adding placeable type")
                        addPlaceableType(typeName, (autoID) => {
                            callback(autoID);
                        })
                    })

                    socket.on("editPlaceables", (callback) => {
                        getMaterials((materials) => {
                            getIntegrity((integrity) => {
                                getSizes((sizes) => {
                                    getPlaceableTypes((types) => {
                                        getPlaceables((placeables) => {
                                            callback(placeables, types, materials, integrity, sizes);
                                        })
                                    })
                                })
                            })
                        })
                    })

                    socket.on("addPlaceable", (placeable, callback) => {
                        addPlaceable(placeable, (autoID) => {
                            callback(autoID);
                        })
                    })

                    socket.on("updatePlaceable", (placeable, callback) => {
                        updatePlaceable(placeable, (updated) => {
                            callback(updated);
                        })
                    })

                    socket.on("getPlaceableAttributes", (callback) => {
                        getMaterials((materials) => {
                            getIntegrity((integrity) => {
                                getSizes((sizes) => {
                                    getPlaceableTypes((types) => {
                                        callback(types, sizes, integrity, materials);
                                    })
                                })
                            })
                        })
                    })

                    socket.on("findPlaceables", (searchText, placeableTypeID, callback) => {
                        findPlaceables(searchText, placeableTypeID, (placeables) => {
                            callback(placeables);
                        })
                    })

                    socket.on("addPlaceableScene", (roomID, sceneID, placeable, count, random) => {

                        function loop(i, arr) {

                            if (i < count) {
                                var placeableClone = structuredClone(placeable);

                                addPlaceableScene(placeableClone, (placeableSceneID) => {

                                    if (placeableSceneID > 0) {
                                        placeableClone.placeableSceneID = placeableSceneID;
                                        arr.push(placeableClone)
                                    }
                                    i++;
                                    loop(i, arr);
                                })

                            } else {
                                console.log(arr)
                                console.log("sending placeableScene update")
                                io.to(roomID).emit("addPlaceableScene", sceneID, arr);
                            }
                        }

                        loop(0, []);

                    })

                    socket.on("findObjects", (searchText, ID, callback) => {
                        /*  
                         { value: 0, label: "Placeables"},
                            { value: 1, label: "Monsters"},
                            { value: 2, label: "Characters"},
                            { value: 3, label: "All" },
                        */
                        console.log("Searching...")
                        switch (ID) {
                            case 0:
                                findPlaceables(searchText, 0, (objects) => {
                                    callback(objects);
                                })
                                break;
                            case 1:

                                findMonsters(searchText, 0, 0, (objects) => {
                                    callback(objects);
                                })
                                break;
                            case 2:
                                findCharacters(searchText, (objects) => {
                                    callback(objects)
                                })
                                break;
                            case 3:
                                find3DObjects(searchText, (objects) => {
                                    callback(objects);
                                })
                                break;
                        }

                    })

                    socket.on("placeableScenePosition", (roomID, placeableSceneID, position) => {
                        io.to(roomID).emit("placeableScenePosition", placeableSceneID, position)
                        setplaceableScenePosition(placeableSceneID, position);
                        //  placeableScenePosition()
                    })

                    socket.on("updateScenePlaceable", (roomID, placeable) => {
                        console.log("update placeableScene")
                        io.to(roomID).emit("updatePlaceableScene", placeable)

                        updateScenePlaceable(placeable);
                    })

                    socket.on("removeScenePlaceable", (roomID, placeableSceneID) => {
                        console.log("remove placeableScene " + placeableSceneID)
                        io.to(roomID).emit("removeScenePlaceable", placeableSceneID)
                        removeScenePlaceable(placeableSceneID);
                    })

                    socket.on("findPlayers", (searchText, searchOptions, campaignID, sceneID, callback) => {
                        findPlayers(searchText, searchOptions, campaignID, sceneID, (players) => {
                            callback(players)
                        })
                    })

                    socket.on("editTextures", (callback) => {
                        getTextures(0, (textures) => {
                            getTextureTypes((types) => {
                                callback(textures, types);
                            })
                        })
                    })

                    socket.on("getTextures", (typeID, callback) => {
                        getTextures(typeID, (textures) => {

                            callback(textures);

                        })
                    })



                    socket.on("addTexture", (texture, callback) => {
                        console.log("adding Texture")
                        received = 0;

                        textureBuffer = "";
                        addTexture(texture, (autoID) => {
                            console.log("textureID " + autoID)
                            callback(autoID)
                        })

                    })

                    socket.on("updateTextureEffect", (texture, callback) => {
                        updateTextureEffect(texture, (success) => {
                            callback(success)
                        })
                    })

                    let received = 0;
                    //let textureBuffer = null;

                    socket.on("sendTextureData", (textureName, directory, textureData = new Uint8Array(), sending, complete, count, callback) => {
                        if (textureData) {
                            console.log("sending:" + sending + " received: " + received + " count: " + count + " bytes Recieved: " + textureData.byteLength)
                            console.log(textureName)
                            /*if (sending == 0) {
                                console.log("creating buffer length : " + imgLength)
                                textureBuffer = new Uint8Array(imgLength)
                            }*/
                            if (received == sending) {
                                if (!complete) {
                                    console.log("adding to file: " + textureData.length)
                                    received++;
                                    appendTexture(textureName, directory, textureData, (written) => {
                                        callback(written)
                                    })
                                } else {
                                    received = 0;
                                    console.log("verifying texture")
                                    checkTexture(textureName, directory, (verified) => {

                                        callback(verified);
                                    })
                                    /* writeTexture(textureName, directory, textureBuffer, (complete)=>{
                                    //     textureBuffer = null;
                                         received =0;
                                         callback(complete);
                                     });*/
                                }
                            } else {
                                console.log("sending received mismatch")
                                received = 0;
                                //   textureBuffer = null;
                                callback(false);
                            }
                        } else {
                            received = 0;
                            console.log("texuredata null")
                            callback(false)
                        }
                    })

                    socket.on("getTextureEffectRev", (textureID, callback) => {
                        getTextureEffectRev(textureID, (rev) => {
                            callback(rev)
                        })
                    })

                    socket.on("updateTextureURL", (texture, callback) => {
                        console.log("finalizing texture:")
                        console.log(texture)
                        updateTextureURL(texture, (updated) => {
                            callback(updated)
                        })
                    })

                    socket.on("deleteTexture", (textureID, deleteFiles, fileName) => {

                        if (deleteFiles == true) {
                            console.log("Deleting texture. (and files)")
                            deleteTexture(textureID);

                            if (fileName && fileName.length > 15) {
                                unlinkTexture(fileName)
                            }

                        } else if (files == false) {
                            console.log("Deleting texture. (Database)")
                            deleteTexture(textureID);
                        }
                    })

                    socket.on("clearTerrainGeometry", (terrainID, rev, callback) => {
                        clearTerrainGeometry(terrainID, rev, (updated) => {
                            console.log("terrain " + terrainID + " cleared " + updated)
                            callback(true)
                        })
                    })

                    socket.on("getTerrainRev", (terrainID, callback) => {
                        getTerrainRev(terrainID, (rev) => {
                            callback(rev);
                        })

                    })

                    socket.on("sendTerrainData", (terrainID, rev, geometryString = "", sending, complete, count, callback) => {
                        if (geometryString) {
                            console.log("sending:" + sending + " received: " + received + " count: " + count + " recieved: " + geometryString.length)

                            /*if (sending == 0) {
                                console.log("creating buffer length : " + imgLength)
                                textureBuffer = new Uint8Array(imgLength)
                            }*/
                            if (received == sending) {
                                if (!complete) {
                                    console.log("adding to file: " + geometryString.length)
                                    received++;
                                    appendTerrainGeometry(terrainID, rev, geometryString, (written) => {
                                        callback(true);
                                    })

                                } else {
                                    received = 0;
                                    console.log("last data: " + geometryString.length)
                                    appendTerrainGeometry(terrainID, rev, geometryString, (written) => {
                                        updateTerrainGeometryUrl(terrainID, rev, (updated) => {
                                            callback(true);
                                        })
                                    })
                                }
                            } else {
                                console.log("sending received mismatch")
                                received = 0;
                                //   textureBuffer = null;
                                callback(false);
                            }
                        } else {
                            received = 0;
                            console.log("terainString null")
                            callback(false)
                        }
                    })

                    socket.on("getCampaignSettings", (campaignID, callback) => {
                        console.log("getting Campaign Settings " + campaignID)
                        getCampaignSettings(campaignID, (campaignInfo) => {
                            //  console.log(campaignInfo)
                            callback(campaignInfo)
                        })
                    })
                    socket.on("updateCampaignName", (campaignID, name, callback) => {
                        console.log("Updating campaign " + campaignID + " name to: " + name)
                        updateCampaignName(campaignID, name, (updated) => {
                            callback(updated)
                        })
                    })
                    socket.on("sendCampaignImageData", (campaignID, name, rev, imageData = null, sending, complete, count, callback) => {
                        if (imageData) {
                            console.log("sending:" + sending + " received: " + received + " count: " + count + " recieved: " + imageData.byteLength)

                            /*if (sending == 0) {
                                console.log("creating buffer length : " + imgLength)
                                textureBuffer = new Uint8Array(imgLength)
                            }*/
                            if (received == sending) {
                                if (!complete) {
                                    console.log("adding to file: " + imageData.byteLength)
                                    received++;
                                    appendCampaignImageData(campaignID, rev, name, imageData, (written) => {
                                        if (written == false) received = 0;
                                        callback(written);
                                    })

                                } else {
                                    received = 0;
                                    console.log("last data: " + imageData.byteLength)
                                    appendCampaignImageData(campaignID, rev, name, imageData, (written) => {
                                        if (written) {
                                            updateCampaignImageUrl(campaignID, rev, name, (updated) => {
                                                callback(updated);
                                            })
                                        }
                                    })
                                }
                            } else {
                                console.log("sending received mismatch")
                                received = 0;
                                //   textureBuffer = null;
                                callback(false);
                            }
                        } else {
                            received = 0;
                            console.log("imageData null")
                            callback(false)
                        }
                    })

                    socket.on("getSceneTerrain", (sceneID, callback) => {
                        getSceneTerrain(sceneID, (terrainArray) => {

                            callback(terrainArray);
                        })
                    })

                    socket.on("removeTerrainLayer", (layerID, callback) => {
                        removeTerrainLayer(layerID, (removed) => {
                            callback(removed)
                        })
                    })


                }else{
                    console.log("disconnected")
                    socket.disconnect();
                }
            });
        }
    }
    console.log(id);

    /* */

}); 
const terrainFilePath = "./arcturus/terrain/"
const textureFilePath = "./arcturus/Images/texture/";
const campaignImgFilePath = "./arcturus/Images/campaignIcons/";

const removeTerrainLayer = (terrainLayerID, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const deleteQuery = "\
DELETE FROM arcturus.terrainLayer \
WHERE terrainLayer.terrainLayerID = " + terrainLayerID;


    mySession.then((mySession) => {
        mySession.sql(deleteQuery).execute().then((result) => {
            if (result.getAffectedItemsCount() > 0) {
                console.log("deleted")
                callback(true)
            } else {
                console.log("not removed")
                callback(false)
            }
        })
    })
}

const getTextureEffectRev = (textureID, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 texture.textureEffectRev \
FROM \
 arcturus.texture \
WHERE \
 texture.textureID = " + textureID;

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {
            const revArray = result.fetchOne();

            callback(revArray[0])
        })
    })
}

const updateTextureEffect = (texture, callback) =>{

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE \
 arcturus.texture \
SET \
 texture.textureEffectUrl = " + mysql.escape(texture.url) + ", \
 texture.textureEffectRev = " + texture.rev + ", \
 texture.textureEffectEnable = true \
WHERE \
 texture.textureID = " + texture.id;

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {
            if (result.getAffectedItemsCount() > 0) {
                console.log("updated")
                callback(true)
            } else {
                console.log("update not needed")
                callback(false)
            }
        })
    })
}


const appendCampaignImageData = (campaignID, rev,name, imgData, callback) => {
    const filePath = campaignImgFilePath + campaignID + "_" + rev + "_" + name;

    console.log("saving terrain Geometry" + filePath)
    //   fs.writeFileSync(filePath, geoString)

    fs.appendFile(filePath, Buffer.from(imgData), (error) => {
        if (error) {
            console.error(error)
            callback(false)
        } else {
            console.log("saved")
            callback(true)
        }
    })

}

const updateCampaignImageUrl = (campaignID,rev,name, callback) => {
    const filePath = "Images/campaignIcons/" + campaignID + "_" + rev + "_" + name;


    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE \
 arcturus.campaign \
SET \
 campaign.campaignImageUrl = " + mysql.escape(filePath) + " \
WHERE \
 campaign.campaignID = " + campaignID;

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {
            if (result.getAffectedItemsCount() > 0) {
                console.log("updated")
                callback(true)
            } else {
                console.log("update not needed")
                callback(false)
            }
        })
    })
}

const updateCampaignName = (campaignID, name, callback) =>{

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE \
 arcturus.campaign \
SET \
 campaign.campaignName = " + mysql.escape( name ) + " \
WHERE \
 campaign.campaignID = " + campaignID;

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {
            if (result.getAffectedItemsCount() > 0) {
                console.log("updated")
                callback(true)
            } else {
                console.log("update not needed")
                callback(false)
            }
        })
    })
}

const getTerrainRev = (terrainID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

        const selectQuery = "\
SELECT \
 terrain.terrainRev \
FROM \
 arcturus.terrain \
WHERE \
 terrain.terrainID = " + terrainID;

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {
           const revArray = result.fetchOne();

           callback(revArray[0])
        })
    })
    

}

const clearTerrainGeometry = (terrainID, rev, callback) =>{
    const filePath = terrainFilePath + terrainID+ "_" + rev + "_terrainGeometry.csv";

    if (fs.existsSync(filePath)){    
        clearTerrainGeometryUrl(terrainID, (cleared)=>{
            console.log("terrain " + terrainID + " was cleared. " + cleared)
            fs.unlink(filePath, err => {
                if (err) {
                    console.log("file: " + filePath + " error.")
                    console.error(err)
                    callback(true)
                }else{
                    console.log(filePath + " unlinked.")
                    callback(true)
                }
            })
        })
    }else{
        callback(true)
    }
}
const clearTerrainGeometryUrl = (terrainID, callback) => {
   

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE \
 arcturus.terrain \
SET \
 terrain.terrainGeometryUrl = null \
WHERE \
 terrain.terrainID = " + terrainID;

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {
            if (result.getAffectedItemsCount() > 0) {
                callback(true)
            } else {
                callback(false)
            }
        })
    })

} 

const appendTerrainGeometry = (terrainID,rev, geoString, callback) =>{
    const filePath = terrainFilePath + terrainID + "_" + rev + "_terrainGeometry.csv";
    console.log("saving terrain Geometry" + filePath)
 //   fs.writeFileSync(filePath, geoString)
  
    fs.appendFile(filePath, geoString, (error)=>{
        if(error)
        {
            console.error(error)
            callback(false)
        }else{
            console.log("saved")
           callback(true)
        }
    })
    
}

const updateTerrainGeometryUrl = (terrainID,rev, callback) =>{
    const url = "terrain/" + terrainID + "_" + rev + "_terrainGeometry.csv";
    
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

        const updateQuery = "\
UPDATE \
 arcturus.terrain \
SET \
 terrain.terrainGeometryUrl = " + mysql.escape( url) + ", \
 terrain.terrainRev = " + rev + " \
WHERE \
 terrain.terrainID = " + terrainID;

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {
           if( result.getAffectedItemsCount() > 0){
                callback(true)
           }else{
               callback(false)
           }
        })
    })
    
} 

const unlinkTexture = (url) => {
    const path = "./arcturus/";
    console.log("unlinking: " + path + url)
    fs.unlink(path + url, err => {
        if (err) {
            console.log("file: " + textureName + " not removed. May not exist.")
        }
    })

}

const appendTexture =(textureName, directory, chunk, callback) =>{
    const path = textureFilePath + directory;

    fs.appendFile(path + textureName, Buffer.from(chunk), (err) => {
        if (err) {
            console.log("write failed.")
            callback(false);
        } else {
            console.log("write succeded")
            callback(true);
        }
    });
}

const checkTexture = (textureName, directory, callback) => {



    const path = textureFilePath + directory;
   // console.log(path + textureName + " buffer: " + textureBuffer.length)
  //  fs.writeFileSync(path + textureName, textureBuffer)
    if (fs.existsSync(path + textureName)) {
        console.log("verified.")
        callback(true);
    } else {
        console.log("no file")
        callback(false);
    }
}

const deleteTexture = (textureID) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const deleteQuery = "\
DELETE FROM \
 arcturus.texture \
WHERE \
 texture.textureID = " + textureID;


    mySession.then((mySession) => {
        mySession.sql(deleteQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("texture removed");

            } else {
                console.log("failed texture removal");

            }

        })
    })
}


const updateTextureURL = (texture, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let updateQuery = "\
UPDATE arcturus.texture SET \
 texture.textureUrl = " + mysql.escape( texture.url) + " \
WHERE \
 texture.textureID = " + texture.textureID;


    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((results) => {
            if (results.getAffectedItemsCount() > 0) {
                callback(true);
            } else {
                callback(false);
            }
        })
    })
}

const addTexture = (texture, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let insertQuery = "\
INSERT INTO arcturus.texture (\
 texture.textureName, \
 texture.textureTypeID )\
Values (\
" + mysql.escape( texture.name) + ", \
" + texture.textureType.textureTypeID + ")"

    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((results) => {
            if (results.getAffectedItemsCount() > 0) {
                callback(results.getAutoIncrementValue());
            } else {
                callback(-1);
            }
        })
    })
}



function formatTextureType(array){
    const textureType = {
        textureTypeID: array[0],
        name:array[1],
        path:array[2]
    }
    console.log(textureType);
    return textureType;
}

function formatTextureTypeArray(array){
    var textureArray = [];

    for(let i =0;i<array.length;i++){
        textureArray.push(
            formatTextureType(array[i])
        )
    }
    return textureArray;
}

const getTextureTypes = (callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let selectQuery = "\
SELECT \
 textureType.textureTypeID, \
 textureType.textureTypeName, \
 textureType.textureTypePath \
FROM \
 arcturus.textureType"

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                callback(formatTextureTypeArray(selectResults.fetchAll()));
            } else {
                callback([]);
            }
        })
    })
}

function formatPlayer(PCarray)
{
        const PC = {
            PCID: PCarray[0],
            name: PCarray[1],
            imageUrl: PCarray[2],
            race: {
                raceID: PCarray[3],
                name: PCarray[4],
            },
            size: {
                sizeID: PCarray[5],
                sizeName: PCarray[6]
            },
            speed: PCarray[7],
            class: {
                classID: PCarray[8],
                name: PCarray[9]
            },
            dice: {
                diceID: PCarray[10],
                name: PCarray[11],
                max: PCarray[12],
            },
            object: {
                objectID: PCarray[13],
                name: PCarray[14],
                url: PCarray[15],
                color: PCarray[16],
                textureUrl: PCarray[17],
                position: null,
            },
            background: {
                backgroundID: -1
            },
            sceneID: PCarray[18],
            user:{
                userID: PCarray[19],
                name:  CapFirstLetter(PCarray[20]),
                email: PCarray[21],
            } 
        }
        console.log(PC)
        return PC;
}

function CapFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatPlayersArray(playersArray){
    var array = [];

    for(let i = 0 ; i < playersArray.length ; i++){
       array.push(
           formatPlayer(playersArray[i])
       ) 
    }

    return array;
}

const findPlayers = (searchText, searchOptions, campaignID, sceneID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    searchText = mysql.escape("%" + searchText + "%");
    console.log(campaignID + " " + sceneID)
    const selectQuery = "\
SELECT \
 PC.PCID, \
 PC.PCName, \
 PC.PCImageUrl, \
 PC.raceID, \
 race.raceName, \
 race.sizeID, \
 size.sizeName, \
 PC.PCSpeed, \
 PC.classID, \
 class.className, \
 PC.diceID, \
 dice.diceName, \
 dice.diceMax, \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 PC.sceneID, \
 campaignUser.userID, \
 user.userName, \
 user.userEmail \
 \
 FROM \
 arcturus.user, \
 arcturus.campaignUser, \
 arcturus.PC, \
 arcturus.object, \
 arcturus.race, \
 arcturus.size, \
 arcturus.class, \
 arcturus.dice \
 \
WHERE \
 campaignUser.userID = user.userID AND \
 campaignUser.campaignID = "+ campaignID + " AND \
 campaignUser.PCID = PC.PCID AND \
 PC.objectID = object.objectID AND \
 PC.raceID = race.raceID AND \
 PC.sizeID = size.sizeID AND \
 PC.classID = class.classID AND \
 PC.diceID = dice.diceID AND \
( \
 PC.PCName LIKE " + searchText + " OR \
 user.userName LIKE " + searchText + " OR \
 user.userEmail LIKE " + searchText + " \
)";
    switch(searchOptions)
    {
        case 0:
            //ALL
            break;
        case 1:
            //ONLINE
            break;
        case 2:
            //OFFLINE
            break;
    }

    console.log()

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {

            if (result.hasData() ) {
                console.log("players found");
                callback(formatPlayersArray(result.fetchAll()))
                
            } else {
                console.log("not found players");
                callback(null)
            }

        })
    })
}

const removeSceneMonster = (monsterSceneID) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }


    const deleteQuery = "\
DELETE FROM \
 arcturus.monsterScene \
WHERE \
 monsterScene.monsterSceneID = " + monsterSceneID;

    mySession.then((mySession) => {
        mySession.sql(deleteQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("monsterScene removed");

            } else {
                console.log("failed monsterScene removal");

            }

        })
    })
}

const updateMonsterScene = (monster) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }


    const deleteQuery = "\
UPDATE \
 arcturus.monsterScene \
SET \
 monsterScene.monsterSceneName = " + mysql.escape(monster.name) + ", \
 monsterScene.monsterSceneImageUrl = " + mysql.escape(monster.imageUrl) + ", \
 monsterScene.monsterTypeID = " + monster.monsterType.monsterTypeID + ", \
 monsterScene.monsterSubTypeID = " + monster.monsterSubType.monsterSubTypeID + ", \
 monsterScene.sizeID = " + monster.size.sizeID + ", \
 monsterScene.monsterSceneMorality = " + monster.morality + ", \
 monsterScene.monsterSceneLawful = " + monster.lawful + ", \
 monsterScene.monsterSceneSTR = " + monster.STR + ", \
 monsterScene.monsterSceneDEX = " + monster.DEX + ", \
 monsterScene.monsterSceneCON = " + monster.CON + ", \
 monsterScene.monsterSceneWIS = " + monster.WIS + ", \
 monsterScene.monsterSceneINT = " + monster.INT + ", \
 monsterScene.monsterSceneCHA = " + monster.CHA + ", \
 monsterScene.diceID = " + monster.dice.diceID + ", \
 monsterScene.monsterSceneDiceModifier = " + monster.diceModifier + ", \
 monsterScene.monsterSceneChallenge = " + monster.challenge + ", \
 monsterScene.monsterSceneSpeed = " + monster.speed + ", \
 monsterScene.monsterSceneXP = " + monster.XP + ", \
 monsterScene.monsterSceneAC = " + monster.AC + ", \
 monsterScene.monsterSceneHP = " + monster.HP + ", \
 monsterScene.monsterSceneObjectName = " + mysql.escape(monster.object.name) + ", \
 monsterScene.monsterSceneObjectUrl = " + mysql.escape(monster.object.url) + ", \
 monsterScene.monsterSceneObjectColor = " + mysql.escape(monster.object.color) + ", \
 monsterScene.monsterSceneObjectTextureUrl = " + mysql.escape(monster.object.textureUrl) + ", \
 monsterScene.monsterSceneObjectScaleX = " + monster.object.scale.x + ", \
 monsterScene.monsterSceneObjectScaleY = " + monster.object.scale.y + ", \
 monsterScene.monsterSceneObjectScaleZ = " + monster.object.scale.z + ", \
 monsterScene.monsterSceneObjectRotationX = " + monster.object.rotation.x + ", \
 monsterScene.monsterSceneObjectRotationY = " + monster.object.rotation.y + ", \
 monsterScene.monsterSceneObjectRotationZ = " + monster.object.rotation.z + ", \
 monsterScene.monsterSceneObjectOffsetX = " + monster.object.rotation.x + ", \
 monsterScene.monsterSceneObjectOffsetY = " + monster.object.rotation.y + ", \
 monsterScene.monsterSceneObjectOffsetZ = " + monster.object.rotation.z + " \
WHERE \
 monsterScene.monsterSceneID = " + monster.monsterSceneID;

    mySession.then((mySession) => {
        mySession.sql(deleteQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("monsterScene removed");

            } else {
                console.log("failed monsterScene removal");

            }

        })
    })
}

const removeScenePlaceable = (placeableSceneID) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    

    const deleteQuery = "\
DELETE FROM \
 arcturus.placeableScene \
WHERE \
 placeableScene.placeableSceneID = " + placeableSceneID;

    mySession.then((mySession) => {
        mySession.sql(deleteQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("placeableScene removed");

            } else {
                console.log("failed placeableScene removal");

            }

        })
    })
}

const updateScenePlaceable = (placeable) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    console.log(placeable)

    const updateQuery = "UPDATE arcturus.placeableScene \
SET \
 placeableScene.placeableSceneName = " + mysql.escape( placeable.name) + ", \
 placeableScene.placeableSceneHP = " + placeable.HP + ", \
 placeableScene.placeableSceneAC = " + placeable.AC + ", \
 placeableScene.placeableSceneStealth = " + placeable.stealth + ", \
 placeableScene.placeableTypeID = " + placeable.placeableType.placeableTypeID + ", \
 placeableScene.integrityID = " + placeable.integrity.integrityID + ", \
 placeableScene.sizeID = " + placeable.size.sizeID + ", \
 placeableScene.materialID = " + placeable.material.materialID + ", \
 placeableScene.placeableSceneObjectName = " + mysql.escape( placeable.object.name) + ", \
 placeableScene.placeableSceneObjectUrl = " + mysql.escape(placeable.object.url) + ", \
 placeableScene.placeableSceneObjectColor = " + mysql.escape(placeable.object.color) + ", \
 placeableScene.placeableSceneObjectTextureUrl = " + mysql.escape(placeable.object.textureUrl) + ", \
 placeableScene.placeableSceneRotationX = " + placeable.object.rotation.x + ", \
 placeableScene.placeableSceneRotationY = " + placeable.object.rotation.y + ", \
 placeableScene.placeableSceneRotationZ = " + placeable.object.rotation.z + ", \
 placeableScene.placeableSceneOffsetX = " + placeable.object.offset.x + ", \
 placeableScene.placeableSceneOffsetY = " + placeable.object.offset.y + ", \
 placeableScene.placeableSceneOffsetZ = " + placeable.object.offset.z + ", \
 placeableScene.placeableSceneScaleX = " + placeable.object.scale.x + ", \
 placeableScene.placeableSceneScaleY = " + placeable.object.scale.y + ", \
 placeableScene.placeableSceneScaleZ = " + placeable.object.scale.z + " \
WHERE \
 placeableScene.placeableSceneID = " + placeable.placeableSceneID;



    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("placeableScene updated");

            } else {
                console.log("failed placeableScene update");

            }

        })
    })
}

const setplaceableScenePosition = (placeableSceneID, position) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    

    const updateQuery = "UPDATE arcturus.placeableScene \
SET \
 placeableScene.placeableSceneX = " + position[0] + ", \
 placeableScene.placeableSceneY = " + position[1] + ", \
 placeableScene.placeableSceneZ = " + position[2] + " \
WHERE \
 placeableScene.placeableSceneID = " + placeableSceneID;

    console.log(updateQuery)

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("placeable updated");
              
            } else {
                console.log("failed placeable update");
               
            }

        })
    })
}

const getMaterials = (callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let selectQuery = "\
SELECT DISTINCT \
 material.materialID, \
 material.materialName, \
 material.diceID, \
 dice.diceMax, \
 material.materialAC, \
 material.materialDmgThreshold \
FROM \
 arcturus.material, \
 arcturus.dice \
WHERE \
 material.diceID = dice.diceID"

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                callback(selectResults.fetchAll());
            } else {
                callback([]);
            }
        })
    })
}

const getIntegrity = (callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let selectQuery = "\
SELECT DISTINCT \
 integrity.integrityID, \
 integrity.integrityName, \
 integrity.integrityMultiplier \
FROM \
 arcturus.integrity"

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                callback(selectResults.fetchAll());
            } else {
                callback([]);
            }
        })
    })
}

function formatObjectCharacter(character){
    
"character.characterID, 0\
 character.characterName, 1\
 object.objectID, 2\
 object.objectName, 3\
 object.objectUrl, 4\
 object.objectColor, 5\
 object.objectTextureUrl 6"

    return {
        characterID: character[0],
        name: character[1],
        object:{
            objectID:character[2],
            name:character[3],
            url:character[4],
            color:character[5],
            textureUrl:character[6]
        }
    }

}

function formatCharacterObjectsArray(objectArray){
    var arr = [];
    for(let i = 0; i < objectArray.length ; i++){
        arr.push(
            formatObjectCharacter(objectArray[i])
        )
    }
    return arr;
}

const findCharacters = (searchText, callback)=>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    searchText = mysql.escape("%" + searchText + "%");

    let selectQuery = "\
SELECT DISTINCT \
 character.characterID, \
 character.characterName, \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl \
FROM \
 arcturus.character, \
 arcturus.object \
 \
WHERE \
 character.objectID = object.objectID AND \
 object.objectName LIKE " + searchText + " \
ORDER BY \
 object.objectName ASC"

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("characters found")

                callback(formatCharacterObjectsArray(selectResults.fetchAll()));
            } else {
                console.log("no characters found")
                callback([]);
            }
        })
    })
}

function format3DObjectArray(objectArray){
    var arr = [];
   
    for(let i =0; i < objectArray.length ; i++){
       arr.push( 
           format3DObject(objectArray[i])
        )
    }

    return arr;
}

function format3DObject(array){
    " object.objectID, 0\
 object.objectName, 1\
 object.objectUrl, 2\
 object.objectColor, 3\
 object.objectTextureUrl 4"

    return {
        objectInfo:1,
        object:{
            objectID: array[0],
            name: array[1],
            url: array[2],
            color: array[3],
            textureUrl: array[4]
        }
    }
}

const find3DObjects = (searchText, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    searchText = mysql.escape("%" + searchText + "%");

    let findQuery = " \
SELECT DISTINCT \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl \
FROM \
 arcturus.object \
WHERE \
 object.objectName LIKE " + searchText + " \
ORDER BY \
 object.objectName ASC"

    mySession.then((mySession) => {
        mySession.sql(findQuery).execute().then((result) => {

            if (result.hasData()) {
                console.log("found objects");
                callback(format3DObjectArray(result.fetchAll()));
            } else {
                console.log("didn't find placeables");
                callback([]);
            }

        })
    })
}

const addPlaceableScene = (placeable,  callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const insertQuery = "\
INSERT INTO arcturus.placeableScene \
( \
 placeableScene.placeableSceneName, \
 placeableScene.placeableSceneHP, \
 placeableScene.placeableSceneAC, \
 placeableScene.placeableSceneStealth, \
 placeableScene.sceneID, \
 placeableScene.placeableID, \
 placeableScene.placeableTypeID, \
 placeableScene.integrityID, \
 placeableScene.sizeID, \
 placeableScene.materialID, \
 placeableScene.placeableSceneObjectName, \
 placeableScene.placeableSceneObjectUrl, \
 placeableScene.placeableSceneObjectColor, \
 placeableScene.placeableSceneObjectTextureUrl, \
 placeableScene.placeableSceneRotationX, \
 placeableScene.placeableSceneRotationY, \
 placeableScene.placeableSceneRotationZ, \
 placeableScene.placeableSceneOffsetX, \
 placeableScene.placeableSceneOffsetY, \
 placeableScene.placeableSceneOffsetZ, \
 placeableScene.placeableSceneScaleX, \
 placeableScene.placeableSceneScaleY, \
 placeableScene.placeableSceneScaleZ \
) \
VALUES \
( \
" + mysql.escape(placeable.name) + ", \
" + placeable.HP + ", \
" + placeable.AC + ", \
" + placeable.stealth + ", \
" + placeable.sceneID + ", \
" + placeable.placeableID + ", \
" + placeable.placeableType.placeableTypeID + ", \
" + placeable.integrity.integrityID + ", \
" + placeable.size.sizeID + ", \
" + placeable.material.materialID + ", \
" + mysql.escape(placeable.object.name) + ", \
" + mysql.escape(placeable.object.url) + ", \
" + mysql.escape(placeable.object.color) + ", \
" + mysql.escape(placeable.object.textureUrl) + ", \
" + placeable.object.rotation.x + ", \
" + placeable.object.rotation.y + ", \
" + placeable.object.rotation.z + ", \
" + placeable.object.offset.x + ", \
" + placeable.object.offset.y + ", \
" + placeable.object.offset.z + ", \
" + placeable.object.scale.x + ", \
" + placeable.object.scale.y + ", \
" + placeable.object.scale.z + " )"

console.log(insertQuery)

    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("placeable inserted");
                callback(result.getAutoIncrementValue());
            } else {
                console.log("failed placeable insert");
                callback(-1);
            }

        })
    })
}
function formatPlaceableSceneArray(array){
    var placeables = [];

    for(let i =0; i<array.length;i++){
        placeables.push(
            formatPlaceableScene(array[i])
        )
    }
    return placeables;
}
function formatPlaceableScene(array){
    const placeable = {
        placeableSceneID: array[0],
        name: array[1],
        HP: array[2],
        AC: array[3],
        stealth: array[4],
        sceneID: array[5],
        placeable:{
            placeableID: array[6],
            name: array[7],
            placeableType:{
                placeableTypeID: array[8],
                name: array[9],
            },
            object:{
                objectID:array[10],
                name:array[11],
                url:array[12],
                color:array[13],
                textureUrl: array[14]
            }
        },
        integrity:{
            integrityID: array[15],
            name: array[16],
            multiplier: array[17],
        },
        material:{
            materialID: array[18],
            name: array[19],
            dice:{
                diceID: array[20],
                max: array[21]
            },
            AC: array[22],
            dmgThreshold: array[23], 
        },
        size:{
            sizeID:array[24],
            name:array[25],
            HPmodifier: array[26],
            ACmodifier: array[27],
        },
        object:{
            name: array[28],
            url: array[29],
            color: array[30],
            textureUrl: array[31],
            rotation:{
                x:array[32],
                y:array[33],
                z:array[34]
            },
            offset:{
                x:array[35],
                y:array[36],
                z:array[37]
            },
            scale:{
                x:array[38],
                y:array[39],
                z:array[40]
            },
            position:[
                array[41],
                array[42],
                array[43]
            ]
        },
        placeableType:{
            placeableTypeID: array[44],
            name: array[45]
        }
    }
    console.log(placeable)
    return placeable;
}
const getScenePlaceables = (sceneID, callback)=>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
   
 
    let selectQuery = " \
SELECT DISTINCT \
 placeableScene.placeableSceneID, \
 placeableScene.placeableSceneName, \
 placeableScene.placeableSceneHP, \
 placeableScene.placeableSceneAC, \
 placeableScene.placeableSceneStealth, \
 placeableScene.sceneID, \
 placeableScene.placeableID, \
 placeable.placeableName, \
 placeable.placeableTypeID, \
 pt1.placeableTypeName, \
 placeable.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 placeableScene.integrityID, \
 integrity.integrityName, \
 integrity.integrityMultiplier, \
 placeableScene.materialID, \
 material.materialName, \
 material.diceID, \
 dice.diceMax, \
 material.materialAC, \
 material.materialDmgThreshold, \
 placeableScene.sizeID, \
 size.sizeName, \
 size.sizeHPmodifier, \
 size.sizeACmodifier, \
 placeableScene.placeableSceneObjectName, \
 placeableScene.placeableSceneObjectUrl, \
 placeableScene.placeableSceneObjectColor, \
 placeableScene.placeableSceneObjectTextureUrl, \
 placeableScene.placeableSceneRotationX, \
 placeableScene.placeableSceneRotationY, \
 placeableScene.placeableSceneRotationZ, \
 placeableScene.placeableSceneOffsetX, \
 placeableScene.placeableSceneOffsetY, \
 placeableScene.placeableSceneOffsetZ, \
 placeableScene.placeableSceneScaleX, \
 placeableScene.placeableSceneScaleY, \
 placeableScene.placeableSceneScaleZ, \
 placeableScene.placeableSceneX, \
 placeableScene.placeableSceneY, \
 placeableScene.placeableSceneZ, \
 placeableScene.placeableTypeID, \
 pt2.placeableTypeName \
FROM \
 arcturus.placeable, \
 arcturus.placeableType as pt1, \
 arcturus.placeableType as pt2, \
 arcturus.placeableScene, \
 arcturus.object, \
 arcturus.material, \
 arcturus.size, \
 arcturus.integrity, \
 arcturus.dice \
WHERE \
 placeableScene.placeableID = placeable.placeableID AND \
 placeable.placeableTypeID = pt1.placeableTypeID AND \
 placeable.objectID = object.objectID AND \
 placeableScene.sizeID = size.sizeID AND \
 placeableScene.materialID = material.materialID AND \
 material.diceID = dice.diceID AND \
 placeableScene.integrityID = integrity.integrityID AND \
 placeableScene.placeableTypeID = pt2.placeableTypeID AND \
 placeableScene.sceneID = " + sceneID + " \
ORDER BY \
 pt2.placeableTypeName ASC"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {

            if (result.hasData()) {
                console.log("found placeables in scene");
                callback(formatPlaceableSceneArray(result.fetchAll()));
            } else {
                console.log("didn't find placeables in scene");
                callback([]);
            }

        })
    })
}

const findPlaceables = (searchText, typeID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    searchText = mysql.escape("%" + searchText + "%");

    let findQuery = " \
SELECT DISTINCT \
 placeable.placeableID, \
 placeable.placeableName, \
 placeable.placeableHP, \
 placeable.placeableAC, \
 placeable.placeableTypeID, \
 placeableType.placeableTypeName, \
 placeable.materialID, \
 material.materialName, \
 placeable.sizeID, \
 size.sizeName, \
 placeable.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 placeable.placeableRotationX, \
 placeable.placeableRotationY, \
 placeable.placeableRotationZ, \
 placeable.placeableOffsetX, \
 placeable.placeableOffsetY, \
 placeable.placeableOffsetZ, \
 placeable.placeableScaleX, \
 placeable.placeableScaleY, \
 placeable.placeableScaleZ, \
 placeable.integrityID, \
 integrity.integrityName, \
 placeable.placeableStealth \
FROM \
 arcturus.placeable, \
 arcturus.placeableType, \
 arcturus.object, \
 arcturus.material, \
 arcturus.size, \
 arcturus.integrity \
WHERE \
 placeable.placeableTypeID = placeableType.placeableTypeID AND \
 placeable.objectID = object.objectID AND \
 placeable.sizeID = size.sizeID AND \
 placeable.materialID = material.materialID AND \
 placeable.integrityID = integrity.integrityID AND \
 placeable.placeableName LIKE " + searchText 


    if(typeID > 0) {
        findQuery = findQuery + " AND \
placeable.placeableTypeID = " + typeID;
    }
    findQuery += " ORDER BY \
placeable.placeableName ASC"

    mySession.then((mySession) => {
        mySession.sql(findQuery).execute().then((result) => {

            if (result.hasData()) {
                console.log("found placeables");
                callback(formatPlaceablesArray(result.fetchAll()));
            } else {
                console.log("didn't find placeables");
                callback([]);
            }

        })
    })
}



const updatePlaceable = (placeable, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    console.log(placeable)

const updateQuery = "UPDATE arcturus.placeable, arcturus.object \
SET \
 placeable.placeableName = " + mysql.escape(placeable.name) + ", \
 placeable.placeableTypeID = " + placeable.placeableType.placeableTypeID + ", \
 object.objectName = " + mysql.escape(placeable.object.name) + ", \
 object.objectUrl = " + mysql.escape(placeable.object.url) + ", \
 object.objectColor = " + mysql.escape(placeable.object.color) + ", \
 object.objectTextureUrl =" + mysql.escape(placeable.object.textureUrl) + ", \
 placeable.materialID = " + placeable.material.materialID + ", \
 placeable.sizeID = " + placeable.size.sizeID + ", \
 placeable.integrityID = " + placeable.integrity.integrityID + ", \
 placeable.placeableRotationX = " + placeable.object.rotation.x + ", \
 placeable.placeableRotationY = " + placeable.object.rotation.y + ", \
 placeable.placeableRotationZ = " + placeable.object.rotation.z + ", \
 placeable.placeableScaleX = " + placeable.object.scale.x + ", \
 placeable.placeableScaleY = " + placeable.object.scale.y + ", \
 placeable.placeableScaleZ = " + placeable.object.scale.z + ", \
 placeable.placeableOffsetX = " + placeable.object.offset.x + ", \
 placeable.placeableOffsetY = " + placeable.object.offset.y + ", \
 placeable.placeableOffsetZ = " + placeable.object.offset.z + ", \
 placeable.placeableAC = " + placeable.AC + ", \
 placeable.placeableHP = " + placeable.HP + ", \
 placeable.placeableStealth = " + placeable.stealth + " \
WHERE \
 placeable.placeableID = " + placeable.placeableID + " AND \
 object.objectID = " + placeable.object.objectID;

 console.log(updateQuery)

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("placeable updated");
                callback(true);
            } else {
                console.log("failed placeable update");
                callback(false);
            }

        })
    })
}

const addPlaceable = (placeable, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const insertQuery = "\
INSERT INTO arcturus.placeable \
( \
 placeable.placeableName, \
 placeable.placeableTypeID, \
 placeable.objectID, \
 placeable.materialID, \
 placeable.sizeID, \
 placeable.integrityID, \
 placeable.placeableRotationX, \
 placeable.placeableRotationY, \
 placeable.placeableRotationZ, \
 placeable.placeableScaleX, \
 placeable.placeableScaleY, \
 placeable.placeableScaleZ, \
 placeable.placeableOffsetX, \
 placeable.placeableOffsetY, \
 placeable.placeableOffsetZ, \
 placeable.placeableAC, \
 placeable.placeableHP, \
 placeable.placeableStealth \
) VALUES \
( \
" + mysql.escape(placeable.name) + ", \
" + placeable.placeableType.placeableTypeID + ", \
" + placeable.object.objectID + ", \
" + placeable.material.materialID + ", \
" + placeable.size.sizeID + ", \
" + placeable.integrity.integrityID + ", \
" + placeable.object.rotation.x + ", \
" + placeable.object.rotation.y + ", \
" + placeable.object.rotation.z + ", \
" + placeable.object.scale.x + ", \
" + placeable.object.scale.y + ", \
" + placeable.object.scale.z + ", \
" + placeable.object.offset.x + ", \
" + placeable.object.offset.y + ", \
" + placeable.object.offset.z + ", \
" + placeable.AC + ", \
" + placeable.HP + ", \
" + placeable.stealth + " ) "
console.log(insertQuery);
    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((result) => {

            if (result.getAffectedItemsCount() > 0) {
                console.log("placeable inserted");
                callback(result.getAutoIncrementValue());
            } else {
                console.log("failed placeable insert");
                callback(-1);
            }

        })
    })
}

function formatPlaceable(array){

    const placeable = {
        placeableID: array[0],
        name: array[1],
        HP: array[2],
        AC: array[3],
        placeableType: {
            placeableTypeID: array[4],
            name: array[5]
        },
        material:{
            materialID:array[6],
            name:array[7],
        },
        size:{
            sizeID: array[8],
            name: array[9],
        },
        object:{
            objectID: array[10],
            name: array[11],
            url: array[12],
            color: array[13],
            textureUrl: array[14],
            rotation:{
                x: array[15],
                y: array[16],
                z: array[17],
            },
            offset:{
                x: array[18],
                y: array[19],
                z: array[20],
            },
            scale:{
              x: array[21],
              y: array[22],
              z: array[23],
            },
        },
        integrity:{
            integrityID: array[24],
            name: array[25]
        },
        stealth: array[26]
    }
    if(placeable.placeableID == 5)console.log(placeable)
    return placeable;
}

function formatPlaceablesArray(array){
    var objectArray = []

    for (let i = 0; i < array.length; i++) {
        objectArray.push(formatPlaceable(array[i]));
    }

    return objectArray;
}

const getPlaceables = (callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const selectQuery = "\
SELECT \
 placeable.placeableID, \
 placeable.placeableName, \
 placeable.placeableHP, \
 placeable.placeableAC, \
 placeable.placeableTypeID, \
 placeableType.placeableTypeName, \
 placeable.materialID, \
 material.materialName, \
 placeable.sizeID, \
 size.sizeName, \
 placeable.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 placeable.placeableRotationX, \
 placeable.placeableRotationY, \
 placeable.placeableRotationZ, \
 placeable.placeableOffsetX, \
 placeable.placeableOffsetY, \
 placeable.placeableOffsetZ, \
 placeable.placeableScaleX, \
 placeable.placeableScaleY, \
 placeable.placeableScaleZ, \
 placeable.integrityID, \
 integrity.integrityName, \
 placeable.placeableStealth \
FROM \
 arcturus.placeable, \
 arcturus.placeableType, \
 arcturus.object, \
 arcturus.material, \
 arcturus.size, \
 arcturus.integrity \
WHERE \
 placeable.placeableTypeID = placeableType.placeableTypeID AND \
 placeable.objectID = object.objectID AND \
 placeable.sizeID = size.sizeID AND \
 placeable.materialID = material.materialID AND \
 placeable.integrityID = integrity.integrityID \
ORDER BY \
 placeable.placeableName ASC";

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {

            if (result.hasData()) {
                console.log("got placeables");
                callback(formatPlaceablesArray(result.fetchAll()));
            } else {
                console.log("no placeables");
                callback([]);
            }

        })
    })
}

const addPlaceableType = (name, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    
    name = mysql.escape(name);

    const insertQuery = "\
INSERT INTO arcturus.placeableType \
 ( placeableTypeName ) \
VALUES (\
 " + name + " \
 )";

    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((result) => {

            if (result.getAffectedItemsCount()) {
                console.log("inserted placeableType");
                callback(result.getAutoIncrementValue());
            } else {
                console.log("failed to insert placeableType");
                callback(-1);
            }

        })
    })
}

const getPlaceableTypes = (callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const selectQuery = "\
SELECT \
 placeableType.placeableTypeID, \
 placeableType.placeableTypeName \
FROM \
 arcturus.placeableType";

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {

            if (result.hasData()) {
                console.log("got placeable types");
                callback(result.fetchAll());
            } else {
                console.log("no placeable types");
                callback([]);
            }

        })
    })
}

const setMonsterScenePosition = (monsterSceneID, position) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE arcturus.monsterScene \
SET \
 monsterScene.monsterSceneX = " + position[0] + ", \
 monsterScene.monsterSceneY = " + position[1] + ", \
 monsterScene.monsterSceneZ = " + position[2] + " \
WHERE \
 monsterScene.monsterSceneID = " + monsterSceneID;

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((result) => {
            affected = result.getAffectedItemsCount()
            if (affected > 0) {
                console.log("updated monsterScene position")

            } else {
                console.log("failed monsterScene position update")
            }
        })
    })

}

const getSceneMonsters = (sceneID, callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    console.log('getting monsters in scene:' + sceneID)
    const selectQuery = "\
SELECT \
 monsterScene.monsterSceneID, \
 monsterScene.monsterSceneName, \
 monsterScene.monsterSceneHP, \
 monsterScene.monsterSceneXP, \
 monsterScene.monsterSceneAC, \
 monsterScene.monsterSceneSpeed, \
 monsterScene.monsterSceneSTR, \
 monsterScene.monsterSceneDEX, \
 monsterScene.monsterSceneCON, \
 monsterScene.monsterSceneWIS, \
 monsterScene.monsterSceneINT, \
 monsterScene.monsterSceneCHA, \
 monsterScene.monsterSceneImageUrl, \
 monsterScene.sizeID, \
 object.objectID, \
 monsterScene.monsterSceneObjectName, \
 monsterScene.monsterSceneObjectUrl, \
 monsterScene.monsterSceneObjectColor, \
 monsterScene.monsterSceneObjectTextureUrl, \
 monsterScene.sceneID, \
 monsterScene.monsterSceneX, \
 monsterScene.monsterSceneY, \
 monsterScene.monsterSceneZ, \
 monsterScene.monsterSceneChallenge, \
 monsterScene.monsterSceneLawful, \
 monsterScene.monsterSceneMorality, \
 monsterScene.monsterSceneDiceMultiplier, \
 monsterScene.diceID, \
 monsterScene.monsterSceneDiceModifier, \
 monsterScene.monsterTypeID, \
 monsterType.monsterTypeName, \
 monsterScene.monsterSubTypeID, \
 monsterSubType.monsterSubTypeName, \
 monsterScene.monsterSceneObjectScaleX, \
 monsterScene.monsterSceneObjectScaleY, \
 monsterScene.monsterSceneObjectScaleZ, \
 monsterScene.monsterSceneObjectRotationX, \
 monsterScene.monsterSceneObjectRotationY, \
 monsterScene.monsterSceneObjectRotationZ, \
 monsterScene.monsterSceneObjectOffsetX, \
 monsterScene.monsterSceneObjectOffsetY, \
 monsterScene.monsterSceneObjectOffsetZ \
FROM \
 arcturus.monsterScene, \
 arcturus.object, \
 arcturus.monsterType, \
 arcturus.monsterSubType \
WHERE \
 monsterScene.monsterTypeID = monsterType.monsterTypeID AND \
 monsterScene.monsterSubTypeID = monsterSubType.monsterSubTypeID AND \
 monsterScene.objectID = object.objectID AND \
 monsterScene.sceneID = " + sceneID;

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {
            if(result.hasData())
            {
                const resultArray = result.fetchAll();
                console.log("monsters found")
                callback(formatMonsterSceneArray(resultArray))
                
            }else{
                console.log("no monsters found")
                callback([])
            }
        })
    })

}

const addMonsterScene = (monster, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    console.log("adding monster to scene")

    console.log(monster)

    let insertQuery = "\
INSERT INTO arcturus.monsterScene (\
 monsterScene.monsterSceneName, \
 monsterScene.monsterSceneHP, \
 monsterScene.monsterSceneXP, \
 monsterScene.monsterSceneAC, \
 monsterScene.monsterSceneSpeed, \
 monsterScene.monsterSceneSTR, \
 monsterScene.monsterSceneDEX, \
 monsterScene.monsterSceneCON, \
 monsterScene.monsterSceneWIS, \
 monsterScene.monsterSceneINT, \
 monsterScene.monsterSceneCHA, \
 monsterScene.monsterSceneImageUrl, \
 monsterScene.sizeID, \
 monsterScene.objectID, \
 monsterScene.sceneID, \
 monsterScene.monsterSceneChallenge, \
 monsterScene.monsterSceneLawful, \
 monsterScene.monsterSceneMorality, \
 monsterScene.monsterSceneDiceMultiplier, \
 monsterScene.diceID, \
 monsterScene.monsterSceneDiceModifier, \
 monsterScene.monsterTypeID, \
 monsterScene.monsterSubTypeID, \
 monsterScene.monsterSceneObjectScaleX, \
 monsterScene.monsterSceneObjectScaleY, \
 monsterScene.monsterSceneObjectScaleZ, \
 monsterScene.monsterSceneObjectRotationX, \
 monsterScene.monsterSceneObjectRotationY, \
 monsterScene.monsterSceneObjectRotationZ, \
 monsterScene.monsterSceneObjectOffsetX, \
 monsterScene.monsterSceneObjectOffsetY, \
 monsterScene.monsterSceneObjectOffsetZ, \
 monsterScene.monsterSceneObjectName, \
 monsterScene.monsterSceneObjectUrl, \
 monsterScene.monsterSceneObjectColor, \
 monsterScene.monsterSceneObjectTextureUrl, \
 monsterScene.monsterID \
) \
VALUES \
( \
" + mysql.escape(monster.name) + ", \
" + monster.HP + ", \
" + monster.XP + ", \
" + monster.AC + ", \
" + monster.speed + ", \
" + monster.STR + ", \
" + monster.DEX + ", \
" + monster.CON + ", \
" + monster.WIS + ", \
" + monster.INT + ", \
" + monster.CHA + ", \
" + mysql.escape(monster.imageUrl) + ", \
" + monster.size.sizeID + ", \
" + monster.object.objectID + ", \
" + monster.sceneID + ", \
" + monster.challenge + ", \
" + monster.lawful + ", \
" + monster.morality + ", \
" + monster.dice.diceMultiplier + ", \
" + monster.dice.diceID + ", \
" + monster.dice.diceModifier + ", \
" + monster.monsterType.monsterTypeID + ", \
" + monster.monsterSubType.monsterSubTypeID + ", \
" + monster.object.scale.x + ", \
" + monster.object.scale.y + ", \
" + monster.object.scale.z + ", \
" + monster.object.rotation.x + ", \
" + monster.object.rotation.y + ", \
" + monster.object.rotation.z + ", \
" + monster.object.offset.x + ", \
" + monster.object.offset.y + ", \
" + monster.object.offset.z + ", \
" + mysql.escape( monster.object.name) + ", \
" + mysql.escape( monster.object.url) + ", \
" + mysql.escape( monster.object.color) + ", \
" + mysql.escape(monster.object.textureUrl) + ", \
" + monster.monsterID + ")"

    console.log(insertQuery)

    mySession.then((mySession) => {
        
        mySession.sql(insertQuery).execute().then((result) => {
            
            const monsterSceneID = result.getAutoIncrementValue(); 
            
            if (monsterSceneID > 0) {
                console.log("monsterScene insert success");
                
                callback(monsterSceneID);

            } else {
            
                console.log("monsterScene insert failed")
                callback(-1);
            }

        })
       
    })
}

const findMonsters = (searchText, monsterTypeID, monsterSubTypeID, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    searchText = mysql.escape("%" + searchText + "%");

    let selectQuery = "\
SELECT \
 monster.monsterID, \
 monster.monsterName, \
 monster.monsterHP, \
 monster.monsterXP, \
 monster.monsterAC, \
 monster.monsterSpeed, \
 monster.monsterSTR, \
 monster.monsterDEX, \
 monster.monsterCON, \
 monster.monsterWIS, \
 monster.monsterINT, \
 monster.monsterCHA, \
 monster.monsterImageUrl, \
 monster.sizeID, \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 monster.monsterChallenge, \
 monster.monsterLawful, \
 monster.monsterMorality, \
 monster.monsterDiceMultiplier, \
 monster.diceID, \
 monster.monsterDiceModifier, \
 monster.monsterTypeID, \
 monsterType.monsterTypeName, \
 monster.monsterSubTypeID, \
 monsterSubType.monsterSubTypeName, \
 monster.monsterObjectScaleX, \
 monster.monsterObjectScaleY, \
 monster.monsterObjectScaleZ, \
 monster.monsterObjectRotationX, \
 monster.monsterObjectRotationY, \
 monster.monsterObjectRotationZ, \
 monster.monsterObjectOffsetX, \
 monster.monsterObjectOffsetY, \
 monster.monsterObjectOffsetZ \
FROM \
 arcturus.monster, \
 arcturus.object, \
 arcturus.monsterType, \
 arcturus.monsterSubType \
 \
WHERE \
 monster.monsterTypeID = monsterType.monsterTypeID AND \
 monster.monsterSubTypeID = monsterSubType.monsterSubTypeID AND \
 monster.objectID = object.objectID" 
 
    if (monsterTypeID > 0){


        if (monsterSubTypeID > 0){
          
            selectQuery += " AND monster.monsterTypeID = " + monsterTypeID
            
            selectQuery += " AND monster.monsterSubTypeID = " + monsterSubTypeID; 
        }else{
            selectQuery += " AND monster.monsterTypeID = " + monsterTypeID
        }
        selectQuery += " AND monster.monsterName LIKE " + searchText;
    }else{
        selectQuery += " AND monster.monsterName LIKE " + searchText;
    }
    
    

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {

            if (result.hasData()) {
                console.log("found monsters");
                callback(formatMonsterArray(result.fetchAll()));
            } else {
                console.log("no monsters found");
                callback([]);
            }

        })
    })
}

const getMonsterTypes = (callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const selectQuery = "\
SELECT \
 monsterType.monsterTypeID, \
 monsterType.monsterTypeName \
FROM \
 arcturus.monsterType";

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {
            
            if (result.hasData()) {
                console.log("got monster types");
                callback(result.fetchAll());
            } else {
                console.log("no monster types");
                callback([]);
            }
            
        })
    })
}

const getMonsterSubTypes = (monsterTypeID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const selectQuery = "\
SELECT \
 monsterType.monsterSubTypeID, \
 monsterType.monsterSubTypeName \
FROM \
 arcturus.monsterSubType, \
 arcturus.monsterTypeSubType \
WHERE \
 monsterSubType.monsterSubTypeID = monsterTypeSubType.monsterSubTypeID AND \
 monsterTypeSubType.monsterTypeID = " + monsterTypeID;

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {

            if (result.hasData()) {
                console.log("got monster sub types for type " + monsterTypeID);
                callback(result.fetchAll());
            } else {
                console.log("no monster sub types");
                callback([]);
            }

        })
    })
}

const leaveScene = (PCID, callback) =>{ 
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const deleteQuery = "\
UPDATE \
 arcturus.PC \
SET \
 PC.sceneID = null, \
 PC.PCx = null, \
 PC.PCy = null, \
 PC.PCz = null \
WHERE \
 PC.PCID = " + PCID;

    mySession.then((mySession) => {
        mySession.sql(deleteQuery).execute().then((result) => {
            const affected = result.getAffectedItemsCount()
            if (affected > 0) {
                console.log("left scene PCID: " + PCID);
            } else {
                console.log("failed leaving scene PCID: " + PCID);
            }
            
        })
    })
}

const endScene = (sceneID, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    if(sceneID === undefined || sceneID == null) sceneID = -1;
    const deleteQuery = "\
UPDATE \
 arcturus.PC \
SET \
 PC.sceneID = null \
 PC.PCx = 0.0 \
 PC.PCy = 0.0 \
 PC.PCz = 0.0 \
WHERE \
 PC.sceneID = " + sceneID;

    mySession.then((mySession) => {
        mySession.sql(deleteQuery).execute().then((result) => {
            const affected = result.affectedRows();
            if(affected > 0){
                console.log("ended scene" + sceneID)
            }else{
                console.log("failed ending scene" + sceneID)
            }
            callback(affected);
        })
    })
}

function setPCscenePosition(PCID, sceneID, position) {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    if(sceneID == null || sceneID === undefined) {
        console.log("setPCscenePOsition: sceneID = null || undefined")
        return;
    }
    const insertQuery = "\
UPDATE \
 arcturus.PC \
SET \
 PC.PCx = " + position[0] + ", \
 PC.PCy = " + position[1] + ", \
 PC.PCz = " + position[2] + ", \
 PC.sceneID = " + sceneID + " \
WHERE \
 PC.PCID = " + PCID;
  
    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((result) => {
            if (result.getAffectedItemsCount()> 0) {
                console.log("updated scene PC: " + PCID + " scene: " + sceneID + " position:" + position)
            } else {
                console.log("fail update scene PC: " + PCID + " scene: " + sceneID + " position:" + position)
                
            }
        })
    })

   
}


const getParty = (userID, campaignID, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
/////////////LINE 18 is SceneID ///19 userID
    const selectQuery = "\
SELECT DISTINCT \
 PC.PCID, \
 PC.PCName, \
 PC.PCImageUrl, \
 PC.raceID, \
 race.raceName, \
 race.sizeID, \
 size.sizeName, \
 PC.PCSpeed, \
 PC.classID, \
 class.className, \
 PC.diceID, \
 dice.diceName, \
 dice.diceMax, \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 PC.PCx, \
 PC.PCy, \
 PC.PCz, \
 PC.sceneID, \
 campaignUser.userID, \
 user.userName \
 \
 FROM \
 arcturus.user, \
 arcturus.campaign, \
 arcturus.campaignUser, \
 arcturus.PC, \
 arcturus.character, \
 arcturus.object, \
 arcturus.race, \
 arcturus.size, \
 arcturus.class, \
 arcturus.dice \
 \
WHERE \
 user.userID = campaignUser.userID AND \
 campaignUser.userID <> " + userID + " AND \
 campaignUser.campaignID = "+ campaignID + " AND \
 campaignUser.PCID = PC.PCID AND \
 PC.objectID = object.objectID AND \
 PC.raceID = race.raceID AND \
 PC.sizeID = size.sizeID AND \
 PC.classID = class.classID AND \
 PC.diceID = dice.diceID";


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((result) => {
            if(result.hasData()){
                const resultArray = result.fetchAll();
                let party = [];
                let i = 0;

               
                resultArray.forEach(PCarray => {
                    const PC = formatPCasObject(PCarray);
                    party.push(PC)
                });
                callback(party);
                
            }else{
                
                callback([])
            }
        })
    })

}
const removeScene = (sceneID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const PCQuery = "\
UPDATE \
 arcturus.PC \
SET \
 PC.sceneID = null  \
WHERE \
 PC.sceneID = " + sceneID;
    
    const sceneMonsterQuery = "\
DELETE FROM arcturus.monsterScene \
WHERE monsterScene.sceneID = " + sceneID;

    const placeableSceneQuery = "\
DELETE FROM arcturus.placeableScene \
WHERE placeableScene.sceneID = " + sceneID;

    const campaignSceneQusery = "\
DELETE FROM arcturus.campaignScene \
WHERE campaignScene.sceneID = " + sceneID;



    const layerQuery = "\
DELETE FROM arcturus.terrainLayer \
WHERE terrainLayer.sceneID = " + sceneID;

    const terrainQuery = "\
DELETE FROM arcturus.terrain \
WHERE terrain.sceneID = " + sceneID;

    const sceneQuery = "\
DELETE FROM arcturus.scene \
WHERE scene.sceneID = " + sceneID;

  

    mySession.then((mySession) => {
        mySession.sql(PCQuery).execute().then((removedPCs) => {
            console.log("removed " + removedPCs.getAffectedItemsCount() +" PCs from scene")

            mySession.sql(sceneMonsterQuery).execute().then((removedMonsters) => {
                console.log("removed " + removedMonsters.getAffectedItemsCount() + " monsters from scene")

                mySession.sql(placeableSceneQuery).execute().then((removedPlaceables) => {
                    console.log("removed " + removedPlaceables.getAffectedItemsCount() + " placeables from scene")

                    mySession.sql(campaignSceneQusery).execute().then((removedCampaignScenes) => {
                        console.log("removed " + removedCampaignScenes.getAffectedItemsCount() + " campaignScenes" )
                    
                        mySession.sql(layerQuery).execute().then((removedLayers) => {
                            console.log("removed " + removedLayers.getAffectedItemsCount() + " layers")
                            
                            mySession.sql(terrainQuery).execute().then((removedTerrain) => {
                                console.log("removed " + removedTerrain.getAffectedItemsCount() + " terrain")

                                mySession.sql(sceneQuery).execute().then((removedScene) => {
                                    console.log("removed " + removedScene.getAffectedItemsCount() + " scene")

                                    callback(true)

                                })

                            })
                        })
    
                    })

                })
            })
        
        })
    })
}


const setCampaignScene = (campaignID, sceneID, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE \
 arcturus.campaign \
SET \
 campaign.sceneID = " + sceneID + " \
WHERE \
 campaign.campaignID = " + campaignID;

    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((set) => {
            const affected = set.getAffectedItemsCount();

            if(affected > 0){
                callback(true);
            }else{
                callback(false);
            }
        })
    })
}


const getSceneTerrain = (sceneID, terrainCallback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
   // 
    const allTerrainQuery = "\
SELECT \
 terrain.terrainID, \
 terrain.terrainWidth, \
 terrain.terrainLength, \
 terrain.terrainImageUrl, \
 terrain.terrainColor, \
 terrain.terrainGeometryUrl, \
 texture.textureID, \
 texture.textureName, \
 texture.textureUrl, \
 terrain.terrainX, \
 terrain.terrainY, \
 terrain.terrainZ, \
 texture.textureEffectEnable, \
 texture.textureEffectUrl \
FROM \
 arcturus.terrain, \
 arcturus.texture \
WHERE \
 terrain.textureID = texture.textureID AND \
 terrain.sceneID = " + sceneID;
 

   
    
    mySession.then((mySession) => {
        mySession.sql(allTerrainQuery).execute().then((terrainResults) => {
            if (terrainResults.hasData()) {
                console.log("terrain found");
                const blocks = terrainResults.fetchAll();
                    
                
                let array = [];
            
                for(let i = 0 ; i < blocks.length ; i ++){
                    array.push( formatTerrainResult(blocks[i]))
                    
                }
                terrainCallback(array);
                
                

               
            
            } else {
                console.log("no terrain found");
                terrainCallback([])
            }
        })
    })

}

const getCurrentScene = (campaignID,isAdmin, userID, sceneCallback) =>{    

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let selectQuery = "";
    if(isAdmin){
        selectQuery= "\
SELECT \
 campaign.sceneID, \
 scene.sceneName, \
 scene.sceneActive, \
 scene.scenePaused, \
 scene.settingID, \
 setting.settingName, \
 scene.roomID \
FROM \
 arcturus.campaign, \
 arcturus.setting, \
 arcturus.scene \
WHERE \
 setting.settingID = scene.settingID AND \
 scene.sceneID = campaign.sceneID AND \
 campaign.campaignID = " + campaignID + " AND \
 campaign.userID = " + userID;
    }else{
        selectQuery = "\
SELECT \
 PC.sceneID, \
 scene.sceneName, \
 scene.sceneActive, \
 scene.scenePaused, \
 scene.settingID, \
 setting.settingName, \
 scene.roomID \
FROM \
 arcturus.campaignUser, \
 arcturus.PC, \
 arcturus.setting, \
 arcturus.scene \
WHERE \
 setting.settingID = scene.settingID AND \
 scene.sceneID = PC.sceneID AND \
 PC.PCID = campaignUser.PCID AND \
 campaignUser.userID = " + userID + " AND \
 campaignUser.campaignID = " + campaignID;

    }

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("Scene found")
                const sceneResult = selectResults.fetchOne();
               // const sceneID = sceneResult[0];
            
                const scene = formatResultAsScene(sceneResult);
                    
              //  scene.terrain = terrainArray;
                console.log("Got current scene")
                sceneCallback(scene);
                
                
            } else {
                console.log("no scene found")
                sceneCallback({ sceneID: -1, sceneName: "", setting:{settingID:-1}, placeables: [], terrain: [], monsters: [], characters:[] })
            }
        })
    })
}

function formatTerrainResult(array){


    console.log("formatting terrain result")

    terrain = {
        terrainID:array[0],
        width: array[1],
        length: array[2],
        imageUrl: array[3],
        color: array[4],
        geometryUrl: array[5],
        texture: {
            textureID: array[6],
            name:array[7],
            url: array[12] == 1 ? array[13] : array[8],
            effect:{
                enable:array[12],
                url:array[13]
            }
        },
        layers: null,
        position: {
            x:array[9],
            y:array[10],
            z:array[11]
        }
    }
    
    return terrain;

}
function formatResultAsScene(array){
    console.log("formatting as scene")
    if("length" in array)
    {
        if(array.length > 4)
        {
            return { 
                sceneID: array[0], 
                roomID:array[6], 
                name: array[1], 
                active:array[2], 
                paused:array[3], 
                setting: { 
                    settingID: array[4], 
                    name: array[5] 
                }};
        
        }else{
            console.log("formatting error not enough fields")
           return null;
        }
    }else{
        console.log("formatting error not an arry")
        return null;
    }
}

function formatScenes(scenes){
    var array = [];
    for(let i = 0; i<scenes.length;i++){
        array.push(
            formatResultAsScene(scenes[i])
        )    
    }
    return array;
}

const getCampaignScenes = (campaignID, scenesCallback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 scene.sceneID, \
 scene.sceneName, \
 scene.sceneActive, \
 scene.scenePaused, \
 scene.settingID, \
 setting.settingName, \
 scene.roomID \
FROM \
 arcturus.scene, \
 arcturus.setting, \
 arcturus.campaignScene \
WHERE \
 scene.settingID = setting.settingID AND \
 scene.sceneID = campaignScene.sceneID AND \
 campaignScene.campaignID = " + campaignID;

    console.log("getting Campaign Scenes")
    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("Scene settings found")
                const sceneResults = selectResults.fetchAll();
    
               
                const scenes = formatScenes(sceneResults);
                
                scenesCallback(scenes);
                    
            
            
            } else {
                console.log("no scenes found")
                scenesCallback([])
            }
        })
    })
}

const addSceneTerrain = (sceneID, terrain, insertedCallback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
   
    if (!("length" in terrain) || !("width" in terrain) || !("color" in terrain)) {
        console.log("attributes not in terrain object")
        insertedCallback(false);
        return;
    }

    const length = Number(terrain.length);
    const width = Number(terrain.width);
    const color = mysql.escape(terrain.color);
    const textureID = terrain.texture.textureID;

    if(length < 1 || width < 1 || sceneID < 1){
        console.log("terrain size or scene ID less than 1")
        insertedCallback(false);
        return;
    }

    const insertQuery = "\
INSERT INTO arcturus.terrain (\
 terrain.terrainWidth, \
 terrain.terrainLength, \
 terrain.terrainColor, \
 terrain.textureID \
) \
VALUES (\
" + length + ", \
" + width + ", \
" + color + ", \
" + textureID + ")";


    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if (insertResults.getAffectedItemsCount() > 0) {
                console.log("terrain inserted.")
                const terrainID = insertResults.getAutoIncrementValue();


                const joinQuery = "\
UPDATE \
 arcturus.scene \
SET \
 scene.terrainID = " + terrainID + " \
WHERE \
 scene.sceneID = " + sceneID;
                console.log(joinQuery)
                mySession.sql(joinQuery).execute().then((joinResults) => {
                    var listAdded = joinResults.getAffectedItemsCount()
                    if (listAdded > 0) {
                        console.log("terrain added to scene")
                        insertedCallback(terrainID);
                    } else {
                        //rollback
                        console.log("terrain not added to scene");
                    }

                   
                })
                //
            } else {
                console.log("Terrain not inserted")
                insertedCallback(false);
            }
        })
    })
}
const createTerrain = (sceneID, textureID,size, array, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    let insertQuery = "\
INSERT INTO arcturus.terrain \
 (textureID, sceneID,terrainWidth,terrainLength, terrainX, terrainY, terrainZ) \
VALUES ";

for(let i = 0; i< array.length;i++)
{
    insertQuery += "\
( \
" + textureID + ", \
" + sceneID + ", \
" + size.width + ", \
" + size.length + ", \
" + array[i].x + ", \
" + array[i].y + ", \
" + array[i].z + " )"
    
if(i <  array.length - 1) insertQuery += " ,"
}
    mySession.then((mySession) => {  
        mySession.sql(insertQuery).execute().then((insertResults) => {
            const inserted = insertResults.getAffectedItemsCount();
            callback(inserted + " rows inserted ")
        })

    
        
    })
}

const createDefaultTerrain = (sceneID,size,textureID, callback) =>{
    const constants = {
        SMALL_SCENE: 1,
        MEDIUM_SCENE: 2,
        LARGE_SCENE: 3,
        HUGE_SCENE: 4,
        SCALE: 1,
        UNITS: 5
    }
    let i = 0;

    let width = 0;
    let depth = 0;

    let x = 0;
    let y = 0;
    let z = 0;
    let w = 0;
    let left = 0;

    switch(size){
        case constants.SMALL_SCENE:
         
            width = 9;
            depth = 9;
            left = x = -20;
            z = -20;
            break;
        case constants.MEDIUM_SCENE:
            width = 21;
            depth = 21;  
      
            left = x = -50;
            z = -50;
            break;
        case constants.LARGE_SCENE:
            width = 81;
            depth = 81;
        
            left = x = -200;
            z = -200;
            break;
        case constants.HUGE_SCENE:
            width = 161;
            depth = 161;
          
            left = x = -400;
            z = -400;
            break;
    }
    array = []

    while(i < (width * depth))
    {
        array.push({x:x,y:y,z:z})
        if(w < width-1){
            x += constants.UNITS;
            w++;
        }else{
            w = 0;
            z += constants.UNITS;
            x = left;
        }
        i++;
    }
   
    createTerrain(sceneID, textureID, { length: constants.UNITS, width: constants.UNITS}, array, (inserted) => {
        callback(inserted)
     })

  
}

const addCampaignScene = (campaignID,roomID, scene, insertedCallback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const tableRoomID = Number(roomID);

    console.log("adding campaignScene to campaign:" + campaignID)

    if (tableRoomID < 1){
        console.log("roomID < 1")
        insertedCallback(false);
        return;
    }

    if (!("name" in scene) || !("setting" in scene) || !("current" in scene || !("terrain" in scene))) {
        console.log("attributes not in scene object")
        insertedCallback(false);
        return;
    }
    if(!("settingID" in scene.setting)){
        console.log("setting ID not in scene.setting")
        insertedCallback(false);
        return;
    }

  

 

    const settingID = Number(scene.setting.settingID);

    if(settingID < 1){
        console.log("setting < 1")
        insertedCallback(false);
        return;
    }
  
                
                const insertQuery = "\
INSERT INTO arcturus.scene (\
 scene.sceneName, \
 scene.settingID, \
 scene.roomID \
) \
VALUES (\
" + mysql.escape(scene.name) + ", \
" + settingID + ", \
" + tableRoomID + " )";
    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if (insertResults.getAffectedItemsCount() > 0) {
                console.log("Scene " + scene.name + " inserted.")
                const sceneID = insertResults.getAutoIncrementValue();


                const joinQuery = "\
INSERT INTO \
 arcturus.campaignScene \
( \
 campaignScene.campaignID, \
 campaignScene.sceneID \
) values ( \
" + campaignID + " , \
" + sceneID +  ")";

                mySession.sql(joinQuery).execute().then((joinResults) => {
                    var listAdded = joinResults.getAffectedItemsCount()
                    if (listAdded){
                        createDefaultTerrain(sceneID,scene.size,scene.textureID, (created)=>{
                          if(created) console.log("default terrain created")
                          if(!created) console.log("failed creating terrain")
                        if (scene.current) {
                            console.log("current?" + scene.current)      
                            const updateQuery = "\
UPDATE \
 arcturus.campaign \
SET \
 campaign.sceneID = " + sceneID + " \
WHERE \
 campaign.campaignID = " + campaignID;
                            mySession.sql(updateQuery).execute().then((updateResults) => {
                                var campaignUpdated = updateResults.getAffectedItemsCount();
                                if (campaignUpdated > 0) {
                                    console.log("current campaign scene changed")
                                } else {

                                    console.log("scene change failed")
                                }
                                insertedCallback(sceneID);
                            })
                        } else {
                            insertedCallback(sceneID);
                        }
                        })
                    }else{
                        //rollback
                        console.log("scene not added to campaign");
                    }
                         
                   
                })
                //
            } else {
                console.log("Scene " + scene.name + " not inserted")
                insertedCallback(-1,);
            }
        })
    })
}

const getSceneSettings = (settings) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 setting.settingID, \
 setting.settingName \
FROM \
 arcturus.setting"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("Scene settings found")
                settings(selectResults.fetchAll());
            } else {
                console.log("no scene settings found")
                settings([]);
            }
        })
    })
}

function formatTexture(arr){
    const texture = {
        textureID:arr[0],
        name: arr[1],
        url: arr[6] == 1 ? arr[7] : arr[2],
        originalUrl: arr[2],
        textureType:{
            textureTypeID: arr[3],
            name: arr[4],
            path: arr[5]
        },
        effect:{
            enable: arr[6],
            url: arr[7],
        }
    }

    return texture;
}

function formatTextureArray(arr){
    var objArray = [];

    for(let i =0 ; i < arr.length ; i++){
        objArray.push(
            formatTexture(arr[i])
        )
    }

    return (objArray);
}

const getTextures = (type, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let selectQuery = "\
SELECT \
 texture.textureID, \
 texture.textureName, \
 texture.textureUrl, \
 texture.textureTypeID, \
 textureType.textureTypeName, \
 textureType.textureTypePath, \
 textureEffectEnable, \
 textureEffectUrl \
FROM \
 arcturus.texture, \
 arcturus.textureType \
WHERE \
 texture.textureTypeID = textureType.textureTypeID"

 if(type > 0){
    selectQuery += " AND texture.textureTypeID = " + type;
 }

    selectQuery += " ORDER BY texture.textureName ASC"

    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("Textures found")
                const textures = formatTextureArray(selectResults.fetchAll());
              
                callback(textures);
            } else {
                console.log("no textures found")
                callback([]);
            }
        })
    })
}


const setPC = (userID, campaignID, PC, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const insertQuery = "\
INSERT INTO arcturus.PC (\
 PC.PCName, \
 PC.PCImageUrl, \
 PC.PCSpeed, \
 PC.diceID, \
 PC.sizeID, \
 PC.raceID, \
 PC.backgroundID, \
 PC.classID, \
 PC.objectID \
 ) \
VALUES (\
" + mysql.escape(PC.name) + ", \
" + mysql.escape(PC.imageUrl) + ", \
" + PC.speed + ", \
" + PC.dice.diceID + ", \
" + PC.size.sizeID + ", \
" + PC.race.raceID + ", \
" + PC.background.backgroundID + ", \
" + PC.class.classID + ", \
" + PC.object.objectID + " \
)";

    


    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if (insertResults.getAffectedItemsCount() > 0) {
                const PCID = insertResults.getAutoIncrementValue();
                console.log("PC " + PC.PCName + " inserted, PCID: " + PCID)
                const updateQuery = "\
UPDATE \
 arcturus.campaignUser \
SET \
 campaignUser.PCID = " + PCID + " \
WHERE \
 campaignUser.userID = " + userID + " AND \
 campaignUser.campaignID = " + campaignID;
                console.log(updateQuery);
                if(PCID > 0){
                    mySession.sql(updateQuery).execute().then((updateResults) => {
                        const updateAffected = updateResults.getAffectedItemsCount();
                        if(updateAffected > 0)
                        {
                            console.log("Campaign PCID updated")
                            
                        }else{
                            console.log("Campaign PCID not updated! Rollback ?")
                        }
                        console.log("PCID:" + PCID)
                        callback(PCID);
                    })          
                }else{
                    callback(-1)
                }      
            } else {
                console.log("PC " + PC.PCName + " not inserted")
                callback(-1);
            }
        })
    })
}

function formatPCasObject(PCarray) {
    console.log("formatting PC as object")

    const PC = {
        PCID: PCarray[0],
        name: PCarray[1],
        imageUrl: PCarray[2],
        race: {
            raceID: PCarray[3],
            name: PCarray[4],
        },
        size:{
            sizeID:PCarray[5],
            sizeName:PCarray[6]
        },
        speed: PCarray[7],
        class:{
            classID:PCarray[8],
            name:PCarray[9]
        },
        dice:{
            diceID:PCarray[10],
            name:PCarray[11],
            max: PCarray[12],
        },
        object: {
            objectID: PCarray[13],
            name: PCarray[14],
            url: PCarray[15],
            color: PCarray[16],
            textureUrl: PCarray[17],
            position: [PCarray[18], PCarray[19], PCarray[20]]
        },
        background: {
            backgroundID: -1
        },
        sceneID: PCarray[21],
        user:{
            userID: PCarray[22],
            name: CapFirstLetter (PCarray[23])
        }
    }

    return PC;
}

const getCampaignUserPC = (userID, campaignID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 PC.PCID, \
 PC.PCName, \
 PC.PCImageUrl, \
 PC.raceID, \
 race.raceName, \
 race.sizeID, \
 size.sizeName, \
 PC.PCSpeed, \
 PC.classID, \
 class.className, \
 PC.diceID, \
 dice.diceName, \
 dice.diceMax, \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 PC.PCx, \
 PC.PCy, \
 PC.PCz, \
 PC.sceneID, \
 campaignUser.userID, \
 user.userName \
 \
 FROM \
 arcturus.user, \
 arcturus.campaignUser, \
 arcturus.PC, \
 arcturus.object, \
 arcturus.race, \
 arcturus.size, \
 arcturus.class, \
 arcturus.dice \
 \
WHERE \
 user.userID = campaignUser.userID AND \
 campaignUser.userID = " + userID + " AND \
 campaignUser.campaignID = "+ campaignID +" AND \
 campaignUser.PCID = PC.PCID AND \
 PC.objectID = object.objectID AND \
 PC.raceID = race.raceID AND \
 PC.sizeID = size.sizeID AND \
 PC.classID = class.classID AND \
 PC.diceID = dice.diceID";



    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("PC found")
                const PCarray = selectResults.fetchOne();
                if(PCarray[0] == -1){
                    callback({PCID:-1})
                }else{
                    
                   

                    callback(formatPCasObject(PCarray));
                    
                }
            } else {
                console.log("no PC found")
                callback({PCID:-1});
            }
        })
    })
}

const updateMonster = (monster, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE arcturus.monster, arcturus.object SET \
 monster.monsterName = " + mysql.escape(monster.name) + ", \
 monster.monsterImageUrl = " + mysql.escape(monster.imageUrl) + ", \
 monster.monsterTypeID = " + monster.monsterType.monsterTypeID + ", \
 monster.monsterSubTypeID = " + monster.monsterSubType.monsterSubTypeID + ", \
 monster.sizeID = " + monster.size.sizeID + ", \
 monster.monsterMorality = " + monster.morality + ", \
 monster.monsterLawful = " + monster.lawful + ", \
 monster.monsterSTR = " + monster.STR + ", \
 monster.monsterDEX = " + monster.DEX + ", \
 monster.monsterCON = " + monster.CON + ", \
 monster.monsterWIS = " + monster.WIS + ", \
 monster.monsterINT = " + monster.INT + ", \
 monster.monsterCHA = " + monster.CHA + ", \
 monster.monsterDiceMultiplier = " + monster.diceMultiplier + ", \
 monster.diceID = " + monster.diceID + ", \
 monster.monsterDiceModifier = " + monster.diceModifier + ", \
 monster.monsterChallenge = " + monster.challenge + ", \
 monster.monsterSpeed = " + monster.speed + ", \
 monster.monsterXP = " + monster.XP + ", \
 monster.monsterAC = " + monster.AC + ", \
 monster.monsterHP = " + monster.HP + ", \
 object.objectName = " + mysql.escape(monster.object.name) + ", \
 object.objectUrl = " + mysql.escape(monster.object.url) + ", \
 object.objectColor = " + mysql.escape(monster.object.color) + ", \
 object.objectTextureUrl = " + mysql.escape(monster.object.textureUrl) + ", \
 monster.monsterObjectScaleX = " + monster.object.scale.x + ", \
 monster.monsterObjectScaleY = " + monster.object.scale.y + ", \
 monster.monsterObjectScaleZ = " + monster.object.scale.z + ", \
 monster.monsterObjectRotationX = " + monster.object.rotation.x + ", \
 monster.monsterObjectRotationY = " + monster.object.rotation.y + ", \
 monster.monsterObjectRotationZ = " + monster.object.rotation.z + ", \
 monster.monsterObjectOffsetX = " + monster.object.rotation.x + ", \
 monster.monsterObjectOffsetY = " + monster.object.rotation.y + ", \
 monster.monsterObjectOffsetZ = " + monster.object.rotation.z + " \
WHERE \
 monster.monsterID = " + monster.monsterID + " AND + \
 object.objectID = " + monster.object.objectID;


    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((results) => {
            if (results.getAffectedItemsCount() > 0) {
                console.log("Monster " + monster.name + " updated.")
                callback(true);
            } else {
                console.log("Monster " + monster.name + " not inserted")
                insertedCallback(false);
            }
        })
    })
}


const addMonster = (monster, insertedCallback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    console.log("adding monster: " + monster.name)

    const insertQuery = "\
INSERT INTO arcturus.monster (\
 monster.monsterName, \
 monster.monsterHP, \
 monster.monsterXP, \
 monster.monsterAC, \
 monster.monsterSpeed, \
 monster.monsterSTR, \
 monster.monsterDEX, \
 monster.monsterCON, \
 monster.monsterWIS, \
 monster.monsterINT, \
 monster.monsterCHA, \
 monster.monsterImageUrl, \
 monster.sizeID, \
 monster.objectID, \
 monster.monsterChallenge, \
 monster.monsterLawful, \
 monster.monsterMorality, \
 monster.monsterDiceMultiplier, \
 monster.diceID, \
 monster.monsterDiceModifier, \
 monster.monsterTypeID, \
 monster.monsterSubTypeID, \
 monster.monsterObjectScaleX, \
 monster.monsterObjectScaleY, \
 monster.monsterObjectScaleZ, \
 monster.monsterObjectRotationX, \
 monster.monsterObjectRotationY, \
 monster.monsterObjectRotationZ, \
 monster.monsterObjectOffsetX, \
 monster.monsterObjectOffsetY, \
 monster.monsterObjectOffsetZ \
) \
VALUES (\
" + mysql.escape(monster.name) + ", \
" + monster.HP + " , \
" + monster.XP + " , \
" + monster.AC + " , \
" + monster.speed + " , \
" + monster.STR + " , \
" + monster.DEX + " , \
" + monster.CON + " , \
" + monster.WIS + " , \
" + monster.INT + " , \
" + monster.CHA + " , \
" + mysql.escape(monster.imageUrl) + ", \
" + monster.size.sizeID + " , \
" + monster.object.objectID  + ", \
" + monster.challenge + " , \
" + monster.lawful + " , \
" + monster.morality + " , \
" + monster.diceMultiplier + " , \
" + monster.diceID + " , \
" + monster.diceModifier + " , \
" + monster.monsterType.monsterTypeID + " , \
" + monster.monsterSubType.monsterSubTypeID + " , \
" + monster.object.scale.x + ", \
" + monster.object.scale.y + ", \
" + monster.object.scale.z + ", \
" + monster.object.rotation.x + ", \
" + monster.object.rotation.y + ", \
" + monster.object.rotation.z + ", \
" + monster.object.offset.x + ", \
" + monster.object.offset.y + ", \
" + monster.object.offset.z + " )";

    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if (insertResults.getAffectedItemsCount() > 0) {
                console.log("Monster " + monster.name + " inserted.")
                insertedCallback(insertResults.getAutoIncrementValue());
            } else {
                console.log("Monster " + monster.name + " not inserted")
                insertedCallback(-1);
            }
        })
    })
}

const addMonsterObject = (monsterID, objectID, insertedCallback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const insertQuery = "\
INSERT INTO arcturus.monsterObject (\
 monsterObject.monsterID, \
 monsterObject.objectID ) \
VALUES (\
" + monsterID + ", \
" + objectID + ")";


    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if (insertResults.getAffectedItemsCount() > 0) {
                console.log("monsterObject " + monsterID + ":" + objectID + " inserted.")
                insertedCallback(true);
            } else {
                console.log("monsterObject " + monsterID + ":" + objectID + " not inserted")
                insertedCallback(false);
            }
        })
    })
}

function formatMonsterSceneArray(monsterArray) {
    if (monsterArray != null && monsterArray !== undefined) {
        if ("length" in monsterArray) {
            var objectArray = [];
            for (let i = 0; i < monsterArray.length; i++) {
                objectArray.push(
                    formatMonsterScene(monsterArray[i])
                )
            }
            return objectArray;
        } else {
            return [];
        }
    } else {
        return [];
    }
}
function formatMonsterScene(monster) {
 
    return {
        monsterSceneID: monster[0],
        name: monster[1],
        HP: monster[2],
        XP: monster[3],
        AC: monster[4],
        speed: monster[5],
        STR: monster[6],
        DEX: monster[7],
        CON: monster[8],
        WIS: monster[9],
        INT: monster[10],
        CHA: monster[11],
        imageUrl: monster[12],
        size: {
            sizeID: monster[13]
        },
        objectID: monster[14],
        object: {
            name: monster[15],
            url: monster[16],
            color: monster[17],
            textureUrl: monster[18],
            position: [monster[20], monster[21], monster[22]],
             scale: {
                x: monster[33],
                y: monster[34],
                z: monster[35],
            },
            rotation: {
                x: monster[36],
                y: monster[37],
                z: monster[38],
            },
            offset: {
                x: monster[39],
                y: monster[40],
                z: monster[41]
            }
        },
        sceneID:monster[19],
        challenge: monster[23],
        lawful: monster[24],
        morality: monster[25],
        diceMultiplier:monster[26],
        diceID: monster[27],
        diceModifier: monster[28],
        monsterType:{
            monsterTypeID: monster[29],
            name: monster[30]
        },
        monsterSubType:{
            monsterSubTypeID: monster[31],
            name: monster[32]
        }
    }
}

function formatMonsterArray (monsterArray) {
    if(monsterArray != null && monsterArray !== undefined){
        if("length" in monsterArray){
            var objectArray = [];
            for(let i = 0; i< monsterArray.length;i++){
                objectArray.push(
                    formatMonster(monsterArray[i])
                )
            }
            return objectArray;
        }else{
            return [];
        }
    }else{
        return [];
    }
}

function formatMonster(monster){



 return {
     monsterID: monster[0],
     name:monster[1],
     HP: monster[2],
     XP: monster[3],
     AC: monster[4],
     speed: monster[5],
     STR: monster[6],
     DEX: monster[7],
     CON: monster[8],
     WIS: monster[9],
     INT: monster[10],
     CHA: monster[11],
     imageUrl:monster[12],
     size:{
         sizeID:monster[13]
     },
     object:{
         objectID:monster[14],
         name:monster[15],
         url:monster[16],
         color:monster[17],
         textureUrl: monster[18],
         scale:{
             x: monster[29],
             y: monster[30],
             z: monster[31],
         },
         rotation:{
             x: monster[32],
             y: monster[33],
             z: monster[34],
         },
         offset:{
             x: monster[35],
             y: monster[36],
             z: monster[37]
         }
     },
     challenge: monster[19],
     lawful: monster[20],
     morality: monster[21],
     diceMultiplier: monster[22],
     diceID: monster[23],
     diceModifier: monster[24],
     monsterType:{
         monsterTypeID: monster[25],
         monsterTypeName: monster[26],
     },
     monsterSubType:{
         monsterSubTypeID: monster[27],
         monsterSubTypeName: monster[28],
     }
 }
}

const getMonsters = (callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 monster.monsterID, \
 monster.monsterName, \
 monster.monsterHP, \
 monster.monsterXP, \
 monster.monsterAC, \
 monster.monsterSpeed, \
 monster.monsterSTR, \
 monster.monsterDEX, \
 monster.monsterCON, \
 monster.monsterWIS, \
 monster.monsterINT, \
 monster.monsterCHA, \
 monster.monsterImageUrl, \
 monster.sizeID, \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 monster.monsterChallenge, \
 monster.monsterLawful, \
 monster.monsterMorality, \
 monster.monsterDiceMultiplier, \
 monster.diceID, \
 monster.monsterDiceModifier, \
 monster.monsterTypeID, \
 monsterType.monsterTypeName, \
 monster.monsterSubTypeID, \
 monsterSubType.monsterSubTypeName, \
 monster.monsterObjectScaleX, \
 monster.monsterObjectScaleY, \
 monster.monsterObjectScaleZ, \
 monster.monsterObjectRotationX, \
 monster.monsterObjectRotationY, \
 monster.monsterObjectRotationZ, \
 monster.monsterObjectOffsetX, \
 monster.monsterObjectOffsetY, \
 monster.monsterObjectOffsetZ \
FROM \
 arcturus.monster, \
 arcturus.object, \
 arcturus.monsterType, \
 arcturus.monsterSubType \
 \
WHERE \
 monster.monsterTypeID = monsterType.monsterTypeID AND \
 monster.monsterSubTypeID = monsterSubType.monsterSubTypeID AND \
 monster.objectID = object.objectID";


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("monsters found")
                callback(formatMonsterArray(selectResults.fetchAll()));
            } else {
                console.log("no monsters found")
                callback([]);
            }
        })
    })
}

const getSenses = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 senses.sensesID, \
 senses.sensesName \
FROM \
 arcturus.senses"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("senses found")
                callback(selectResults.fetchAll());
            } else {
                console.log("no senses found")
                callback([]);
            }
        })
    })
}

const getLanguages = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 language.languageID, \
 language.languageName \
FROM \
 arcturus.language"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("languages found")
                callback(selectResults.fetchAll());
            } else {
                console.log("no languages found")
                callback([]);
            }
        })
    })
}

const getTraits = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 trait.traitID, \
 trait.traitName \
FROM \
 arcturus.trait"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("traits found")
                callback(selectResults.fetchAll());
            } else {
                console.log("no traits found")
                callback([]);
            }
        })
    })
}

const getMonsterActions = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 action.actionID, \
 action.actionName \
FROM \
 arcturus.action, \
 arcturus.actionType";


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("actions found")
                callback(selectResults.fetchAll());
            } else {
                console.log("no actions found")
                callback([]);
            }
        })
    })
}

const getSizes = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 size.sizeID, \
 size.sizeName, \
 size.sizeHPmodifier, \
 size.sizeACmodifier, \
 size.sizeHideModifier, \
 size.sizeDiameter, \
 size.sizeMinHeight, \
 size.sizeMaxHeight, \
 size.sizeMinWeight, \
 size.sizeMaxWeight \
FROM \
 arcturus.size"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("sizes found")
                callback(selectResults.fetchAll());
            } else {
                console.log("no sizes found")
                callback([]);
            }
        })
    })
}

const getSkills = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 skill.skillID, \
 skill.skillName \
FROM \
 arcturus.skill"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("Skills found")
                callback(selectResults.fetchAll());
            } else {
                console.log("no skills found")
                callback([]);
            }
        })
    })
}


const getAllMonsterSubTypes = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 monsterSubType.monsterSubTypeID, \
 monsterSubType.monsterSubTypeName \
FROM \
 arcturus.monsterSubType \
ORDER BY monsterSubType.monsterSubTypeName ASC"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("Monster Sub-Types found")
              
                callback(selectResults.fetchAll());
            } else {
                console.log("No Monster Sub-Types found")
                callback([]);
            }
        })
    })
}

const updateCharacter = (characterID, characterName, raceID, classID, characterPlayable, characterImageUrl, objectID, objectName, objectUrl, objectColor, objectTextureUrl, isUpdated) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const updateQuery = "\
UPDATE \
 arcturus.character, arcturus.object \
SET \
 character.characterName = "+ mysql.escape(characterName) +", \
 character.raceID = "+ raceID + ", \
 character.classID = "+ classID + ", \
 character.characterPlayable = "+ mysql.escape(characterPlayable) + ", \
 character.characterImageUrl = " + mysql.escape(characterImageUrl) + ", \
 object.objectName = " + mysql.escape(objectName) +", \
 object.objectUrl = "+ mysql.escape(objectUrl) + ", \
 object.objectColor = "+ mysql.escape(objectColor) +", \
 object.objectTextureUrl = " + mysql.escape(objectTextureUrl) + " \
  \
WHERE \
character.characterID = " + characterID + " AND \
object.objectID = " + objectID;


    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((updateResults) => {
            if (updateResults.getAffectedItemsCount() > 0) {
                console.log("character " + characterID + " object:" + objectID + " updated.")
                isUpdated(true);
            } else {
                console.log("character " + characterID + " object:" + objectID + " not updated")
                isUpdated(false);
            }
        })
    })
}

const updateCharacterObject = (characterID, objectID, insertedCallback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const insertQuery = "\
UPDATE arcturus.character SET \
 character.objectID = " + objectID + " \
WHERE \
 character.characterID = " + characterID ;


    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if(insertResults.getAffectedItemsCount() > 0)
            {
                console.log("characterObject " + characterID + ":" +objectID+ " inserted.")
                insertedCallback(true);
            }else{
                console.log("characterObject " + characterID + ":" +objectID+ " not inserted")
                insertedCallback(false);
            }
        })
    })
}

const addObject = (object = {}, insertedCallback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const insertQuery = "\
INSERT INTO arcturus.object (\
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl ) \
VALUES (\
" + mysql.escape(object.name) + ", \
" + mysql.escape(object.url) + " , \
" + mysql.escape(object.color) + " , \
" + mysql.escape(object.textureUrl) + ")";


    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if(insertResults.getAffectedItemsCount() > 0)
            {
                const autoID = insertResults.getAutoIncrementValue();
                console.log("object " + object.name + " inserted.")
                insertedCallback(autoID);
            }else{
                console.log("object " + object.name + " not inserted")
                insertedCallback(-1);
            }
        })
    })
}

const addCharacter = (character ={}, insertedCallback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const insertQuery = "\
INSERT INTO arcturus.character (\
 character.characterName, \
 character.raceID, \
 character.classID, \
 character.objectID, \
 character.characterPlayable, \
 character.characterImageUrl \
 ) \
VALUES (\
" + mysql.escape(character.name) + ", \
" + character.race.raceID + ", \
" + character.class.classID + ", \
" + character.object.objectID + ", \
" + character.playable + " , \
" + mysql.escape(character.imageUrl) + ")";


    mySession.then((mySession) => {
        mySession.sql(insertQuery).execute().then((insertResults) => {
            if(insertResults.getAffectedItemsCount() > 0)
            {
                const autoID = insertResults.getAutoIncrementValue();
                console.log("character " + characterName + " inserted.")
                insertedCallback(autoID);
            }else{
                console.log("character " + characterName + " not inserted")
                insertedCallback(-1);
            }
        })
    })
}

const getRaceNames = (callback) => {

     if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 race.raceID, \
 race.raceName \
FROM \
 arcturus.race"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if(selectResults.hasData())
            {
                console.log("races found")
                callback(formatRaces(selectResults.fetchAll()));
            }else{
                console.log("no races found")
                callback([]);
            }
        })
    })
}

function formatRaces(raceArray){
    if(raceArray.length > 0)
    {
        var array = [];
        for(let i =0; i< raceArray.length; i++){
            array.push(
                {
                    raceID: raceArray[i][0],
                    name: raceArray[i][1]
                }
            )
        }
        return array;
    }else{
        return [];
    }
}


const getClassNames = (callback) => {

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    const selectQuery = "\
SELECT \
 class.classID, \
 class.className \
FROM \
 arcturus.class"


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if (selectResults.hasData()) {
                console.log("classes found")
                callback(formatClasses(selectResults.fetchAll()));
            } else {
                console.log("no classes found")
                callback([]);
            }
        })
    })
}

function formatClasses(classArray) {
    if (classArray.length > 0) {
        var array = [];
        for (let i = 0; i < classArray.length; i++) {
            array.push(
                {
                    classID: classArray[i][0],
                    name: classArray[i][1]
                }
            )
        }
        return array;
    } else {
        return [];
    }
}

const getCharacters = (playable, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    let selectQuery = "\
SELECT \
 character.characterID, \
 character.characterName, \
 character.characterImageUrl, \
 character.raceID, \
 race.raceName, \
 race.sizeID, \
 size.sizeName, \
 race.raceSpeed, \
 class.classID, \
 class.className, \
 class.diceID, \
 dice.diceName, \
 dice.diceMax, \
 object.objectID, \
 object.objectName, \
 object.objectUrl, \
 object.objectColor, \
 object.objectTextureUrl, \
 character.characterPlayable \
FROM \
 arcturus.character, \
 arcturus.object, \
 arcturus.race, \
 arcturus.size, \
 arcturus.class, \
 arcturus.dice \
 \
WHERE \
 character.objectID = object.objectID AND \
 character.raceID = race.raceID AND \
 race.sizeID = size.sizeID AND \
 character.classID = class.classID AND \
 class.diceID = dice.diceID";

 if(playable != 2){
     selectQuery += " AND character.characterPlayable = " + playable;
 }


    mySession.then((mySession) => {
        mySession.sql(selectQuery).execute().then((selectResults) => {
            if(selectResults.hasData())
            {
                console.log("characters found")
                const resultArray = selectResults.fetchAll();
                let characters = [];
                resultArray.forEach(character => {
                    
                    characters.push(formatCharacter(character));    
                });
                callback(characters);
            }else{
                console.log("no characters found")
                callback([]);
            }
        })
    })
}

function formatCharacter(char){

    const character = {
        characterID:char[0],
        name: char[1],
        imageUrl: char[2],
        playable: char[18],
        race: {
            raceID:char[3],
            name:char[4],
            size:{
                sizeID:char[5],
                name: char[6],
            },
            speed: char[7],
        },
        class: {
            classID: char[8],
            className: char[9],
            dice: {
                diceID: char[10],
                diceName: char[11],
                diceMax: char[12],
            }
        },
        object: {
            objectID: char[13],
            name: char[14],
            url: char[15],
            color: char[16],
            textureUrl: char[17],
            position: null
        } 
    }

    return character;
}

const updateUserRoom = (userID = 0, roomID = 0, options = {}, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const peerID = "peerID" in options ? mysql.escape(options.peerID) : "";
    const audio = "audio" in options ? options.audio ? 1 : 0 : 0;
    const video = "video" in options ? options.video ? 1 : 0 : 0;
    const media = "media" in options ? options.media ? 1 : 0 : 0;

    const updateQuery = "\
UPDATE arcturus.userRoom \
SET\
 userRoom.userRoomID = " + peerID + " ,\
 userRoom.userRoomAudio = " + audio + " ,\
 userRoom.userRoomVideo = " + video + " ,\
 userRoom.userRoomMedia = " + media + " \
WHERE \
 userRoom.userID = " + userID + " AND \
 userRoom.roomID = " + roomID;
    
    mySession.then((mySession) => {
        mySession.sql(updateQuery).execute().then((updateResults) => {
            const affected = updateResults.getAffectedItemsCount();
            if (affected > 0) {
                console.log("updated user: " + userID + " stream:" + audio + ":" + video + ":" + media)
            } else {
              
            }
            callback(affected);
        })
    })
}

const createCampaignUser = ( userID =-1, campaignID = -1, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    const joinCampaignQuery = "INSERT INTO arcturus.campaignUser (campaignUser.userID, campaignUser.campaignID) values (\
" + userID + " , " + campaignID + ")";

    mySession.then((mySession) => {
        mySession.sql(joinCampaignQuery).execute().then((joinResults) => {
            const affected = joinResults.getAffectedItemsCount();
            if(affected > 0)
            {
                console.log("userID:" + userID + " Joined campaignID: " + campaignID)
            }else{
                console.log("user" + userID +" did not join campaign " + campaignID)
            }
            callback(affected);
        })
    })
}

const searchCampaigns = (text = "", userID = "-1", callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    text = mysql.escape("%" + text + "%");
    //
  /*  const selectCampaigns = "SELECT campaign.campaignID, campaign.campaignName, image.imageString, campaign.roomID, campaign.userID FROM \
arcturus.campaign, arcturus.campaignUser, arcturus.image, arcturus.status WHERE campaign.imageID = image.imageID AND campaign.campaignID = campaignUser.campaignID AND \
campaignUser.userID <> " + userID + " AND campaign.userID <> " + userID + " AND campaign.statusID = status.statusID AND status.statusName <> 'Closed' \
AND campaign.campaignName LIKE " + text;*/

    const selectCampaigns = "SELECT DISTINCT campaign.campaignID, campaign.campaignName, image.imageString, campaign.roomID, campaign.userID FROM \
arcturus.campaign, arcturus.image, arcturus.userRoom WHERE campaign.campaignName LIKE " + text + " AND campaign.userID <> " + userID + " \
AND campaign.imageID = image.imageID AND userRoom.roomID = campaign.roomID AND userRoom.userID <> " + userID;

    mySession.then((mySession) => {
        mySession.sql(selectCampaigns).execute().then((campaignResults) => {
            const hasCampaigns = campaignResults.hasData();
            if(hasCampaigns){
                var campaigns = campaignResults.fetchAll();
                console.log(campaigns.length + " campaigns Found")

                callback(campaigns);
            }else{
                console.log("no campaigns found")
                callback([]);
            }
        })
    })
}

function formatCampaignInformation(array){
    const campaignInfo = {
        campaignID: array[0],
        name: array[1],
        imageUrl: array[2],
        rev: array[3]
    }
    return campaignInfo;
}

const getCampaignSettings = (campaignID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //
    const selectCampaigns = " \
SELECT \
 campaign.campaignID, \
 campaign.campaignName, \
 campaign.campaignImageUrl, \
 campaign.campaignImageRev \
FROM \
 arcturus.campaign \
WHERE \
 campaign.campaignID = " + campaignID;


    mySession.then((mySession) => {
        mySession.sql(selectCampaigns).execute().then((campaignResults) => {
            const found = campaignResults.hasData()
            console.log("has campaign information " + found)

            if (found) {
                callback(formatCampaignInformation(campaignResults.fetchOne()))
            } else {
                callback(null)
            }

        })
    })
}

const getCampaigns = (userID = -1, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //
    const selectCampaigns = " \
SELECT \
 campaign.campaignID, \
 campaign.campaignName, \
 campaign.campaignImageUrl, \
 campaign.roomID, \
 campaign.userID, \
 campaign.campaignImageRev \
FROM \
 arcturus.campaign, \
 arcturus.userRoom \
WHERE \
 userRoom.roomID = campaign.roomID AND \
 userRoom.userID = " + userID;
  

    mySession.then((mySession) => {
        mySession.sql(selectCampaigns).execute().then((campaignResults) => {
            const found = campaignResults.hasData()
            console.log("has campaigns " + found)
            
            if(found){
                callback(campaignResults.fetchAll())
            }else{
                callback([])
            }
            
        })
    })
}

const getImage = (imageID = -1, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //
    const selectImage = "SELECT image.imageString FROM arcturus.image WHERE image.imageID = \
" + imageID;

    mySession.then((mySession) => {

        mySession.sql(selectImage).execute().then((imgData) => {
            if(imgData.hasData())
            {
                console.log("returning the image")
                callback(imgData.fetchOne()[0]);
            }else{
                console.log("didn't find the image")
                callback(false);
            }
        })
    }).catch((reason) => {
        console.log(reason);
        callback(false);
    })
}

const createCampaign = (userID = -1, campaignName = "", imgFile = "", statusName = "", callback) =>{
    const sqkCampaignName = mysql.escape(campaignName);
    imgFile = mysql.escape(imgFile);
    statusName = mysql.escape(statusName);

    const insertImage = "INSERT INTO arcturus.image (image.imageName, image.imageString) VALUES (\
" + sqkCampaignName + "," + imgFile + " )";

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //
    

    mySession.then((mySession) => {
    
        mySession.sql(insertImage).execute().then((updatedImage) => {
            const imageID = updatedImage.getAutoIncrementValue();
            if (imageID > 0) {
                const insertCampaign = "INSERT INTO arcturus.campaign (campaign.userID, campaign.campaignName, campaign.imageID, campaign.statusID) VALUES (\
" + userID + " , " + sqkCampaignName + " , " + imageID + ", (SELECT status.statusID FROM arcturus.status WHERE status.statusName = \
" + statusName +") )";

                mySession.sql(insertCampaign).execute().then((updatedCamp) => {
                    const campID = updatedCamp.getAutoIncrementValue();

                    if(campID > 0){
                        console.log("campaign created calling back")
                        createRoom(userID, campaignName,(roomID = -1, roomName = "") => {
                           console.log("Adding room to campaign")
                            addRoomToCampaign(campID, roomID, (affected) =>{
                                callback([campID, campaignName, imageID,roomID, userID])
                            })
                        })
                    }else{
                        const deleteImg = "DELETE FROM arcturus.image WHERE imageID = " + imageID;
                        mySession.sql(deleteImg).execute().then((deletedImg) => {
                            console.log("campaign not created, deleting image and returning")
                            callback({notCreated:true});
                        })
                    }
                })
                
            }else{
                console.log("Could not create campaign")
                callback({notCreated:true})
            }
        })
    }).catch((reason)=>{
        console.log(reason);
    })
}

const createRoom = (userID = -1, roomName = "", callback) => {
    roomName = mysql.escape(roomName)
    const query = "INSERT INTO arcturus.room (room.roomName) values (" + roomName + ")";

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //
    console.log("Creating Room: " + roomName);
    mySession.then((mySession) => {
        mySession.sql(query).execute().then((roomCreated) => {
            const roomID = roomCreated.getAutoIncrementValue();
            if(roomID > 0)
            {
                console.log(roomID + " created.")
                addUserToRoom(userID,roomID,(affected) =>{
                    callback(roomID, roomName);
                })
            }else{
                callback(-1, "");
            }
        })
    })
}

const addRoomToCampaign = (campID = -1, roomID = -1, callback) => {
    console.log("adding room " + roomID + " to campaign: " + campID);
    const userRoomQuery = "UPDATE arcturus.campaign SET campaign.roomID = " + roomID + " WHERE campaign.campaignID = " + campID;
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //d


    mySession.then((mySession) => {
        mySession.sql(userRoomQuery).execute().then((userAddedToRoom) => {
            const affected = userAddedToRoom.getAffectedItemsCount();
            console.log(roomID + " added to: " + campID + "affected: " + affected)
            callback(affected)
        })
    })
}

const addUserToRoom = (userID = -1, roomID = -1, callback) => {
    console.log("adding user " +userID + " to room: " + roomID);
    const userRoomQuery = "INSERT INTO arcturus.userRoom SET userRoom.roomID = " + roomID + ", userRoom.userID = " + userID + ", userRoom.statusID = (\
SELECT status.statusID FROM arcturus.status WHERE status.statusName = 'Offline')";
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //d


    mySession.then((mySession) => {
        mySession.sql(userRoomQuery).execute().then((userAddedToRoom) => {
            const affected = userAddedToRoom.getAffectedItemsCount();
            console.log(userID + "affected: " + affected + " room: ", roomID)
            callback(affected)
        })
    })
}

const updateUserStatus = (userID = -1, statusID = 5, socketID = "", callback) => {
    let query = "UPDATE arcturus.user SET user.userSocket = " + mysql.escape( socketID )+ "\
, user.statusID = " + statusID + " WHERE userID =" + userID; 

   console.log(query)


    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((updated) => {
            const affected = updated.getAffectedItemsCount();
            console.log("updated status affected: " + affected)
            if (affected > 0) {
               query = "select userRoom.roomID, status.statusName from arcturus.userRoom, arcturus.status WHERE userRoom.userID = \
 " + userID + " AND status.statusID = userRoom.statusID";
                mySession.sql(query).execute().then((found) => {
                    const inRooms = found.hasData()
                    const rooms = inRooms ? found.fetchAll() : [];
                    
                    const contactQuery = "\
SELECT distinct userID, userSocket \
FROM arcturus.user, arcturus.status, arcturus.contact \
WHERE \
statusName = 'Online' AND \
status.statusID = user.statusID AND \
contact.userID = user.userID AND \
contact.contactID = " + userID;

                    callback(inRooms, rooms);
                })
            }else{
                callback(false,0);
            }
          
        })
    }).catch((reason) => {
        console.log(reason);
    })
}

const getUser = (socketID = "", callback) => {
    console.log("getting userID for: " + socketID);

    const query = "SELECT user.userID, user.userName FROM arcturus.user WHERE user.userSocket = " + mysql.escape(socketID);


    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    //

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((result) => {
            const user = result.fetchOne()

            if(result.hasData())
            {
                callback(user[0], user[1])
            }else{
                callback(-1);
            }
        })
    })

}

const cleanRooms = (userID = 0, callback) =>
{   
    const roomQuery = "\
UPDATE arcturus.userRoom \
SET\
 userRoom.userRoomID = '' ,\
 userRoom.userRoomAudio = 0 ,\
 userRoom.userRoomVideo = 0 ,\
 userRoom.userRoomMedia = 0 ,\
 userRoom.statusID = (\
SELECT status.statusID \
FROM arcturus.status \
WHERE status.statusName = 'Offline' \
) \
WHERE\
 userRoom.userID = " + userID;

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    mySession.then((mySession) => {
        mySession.sql(roomQuery).execute().then((userRooms) => {
            const roomsAffected = userRooms.getAffectedItemsCount();
            callback(roomsAffected);
        })
    }).catch((reason)=>{
        console.log(reason);
    })
}




const setUserRoomStatus = (room ="", userID = -1, status = "Offline",callback) => {
    room = mysql.escape(room);
    if (userID =="" || userID == null || userID === undefined  || userID < 1) { callback(false); }
    let affectedRows = 0;

    let update = "\
UPDATE arcturus.userRoom, arcturus.status \
SET userRoom.statusID = status.statusID \
WHERE userRoom.userID = " + userID + " \
AND status.statusName = " + mysql.escape(status);

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
  console.log(update);
    console.log("setUserRoomStatus (room:userID): " + room + ":" + userID)
    

    mySession.then((mySession) => {
        mySession.sql(update).execute().then((results) => {
            affectedRows = results.getAffectedItemsCount();

            if(affectedRows > 0){
                callback(true);
            }else{
                callback(false);
            }
        })
    })

}

const getRoomUsers = (room = "", userID = -1, callback) => {
    room = mysql.escape(room);
    let query = "\
SELECT \
user.userID, \
user.userName, \
s1.statusName as userStatus, \
s2.statusName as roomStatus, \
userRoom.userRoomID, \
userRoom.userRoomAudio, \
userRoom.userRoomVideo, \
userRoom.userRoomMedia \
FROM \
arcturus.user, \
arcturus.userRoom, \
arcturus.status s1, \
arcturus.status s2 \
WHERE \
s1.statusID = user.statusID AND \
s2.statusID = userRoom.statusID AND \
user.userID = userRoom.userID AND \
userRoom.roomID = " + room + " AND \
userRoom.userID <> " + userID;

    console.log("Getting users in: " + room);
    

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    mySession.then((mySession) => {

        mySession.sql(query).execute().then((result) => {
            console.log("room has users: " + result.hasData());
            if (result.hasData()) {
                const users = result.fetchAll();
             
                callback(users);
            } else {
                callback([]);
            }
        })
    })
}

const storeMessage = (room = 0, userID = 0, type = 0, msg = "", callback) => {
    msg = mysql.escape(msg);
    const roomString = room.toString();
    const userIDString = userID.toString();
    const typeString = type.toString();

    let query = "INSERT INTO arcturus.message (roomID, userID, messageType, messageText) VALUES \
("  + roomString + ", " + userIDString + ", " + typeString + ", " + msg + ")";

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    console.log("storing message:");
    

    mySession.then((mySession) => {
        mySession.sql(query).execute().then((result) => {
            let affected = result.getAffectedItemsCount();
            console.log("inserted (number of rows): " + affected)
            if(affected > 0){
                callback(true);
            }else{
                callback(false);
            }
        })
    }).catch((reason) => {
        callback(false);
    })
}

const getStoredMessages = (room = "", callback) => {
    room = mysql.escape(room);
    let query = "SELECT user.userName, message.messageType, message.messageText FROM arcturus.message, arcturus.user WHERE \
user.userID = message.userID AND message.roomID = " + room + " ORDER BY message.messageID";

    console.log("Getting stored messages in: " + room);
  

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    mySession.then((mySession) => {

        mySession.sql(query).execute().then((result) => {
            console.log("has messages: " + result.hasData());
            if(result.hasData()){
                const messages = result.fetchAll();
                console.log(messages[0])
                callback(messages);
            }else{
                callback([]);
            }
        })
    })
}

const checkReferral = (code ="", callback) => {
    code = mysql.escape(code);

    let query = "SELECT refID from arcturus.ref WHERE refCode = " + code;
    
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

  

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((result) => {
            console.log(result.hasData())
            if (typeof result === undefined) {
                console.log("result undefined")
               callback(-1);
            }else if (result.hasData()){
                console.log(result);
                const refID = result.fetchOne()[0];
                console.log("refID valid refID: " + refID);
                query = "SELECT refID from arcturus.user WHERE refID = " + refID;
               

                mySession.sql(query).execute().then((results2) => {
                    console.log(results2.hasData());
                    if (results2.hasData()) {
                        console.log("refID used. No longer valid.")
                        callback(-1);
                     
                    } else {
                        if(typeof results2 === undefined )
                        {
                            callback(-1);
                        }else{
                            console.log("refID not used sending to callback.")
                            callback(refID);
                        }
                    }
                }).catch((reason) => {
                    console.log(reason);
                    callback(-1);
                })
            } else{
                console.log("Refferal code not valid.")
                callback(-1);
            }
        })
    }, (reason) => {
        console.log(reason);
        callback(-1);
    }).catch((reason) => {
        console.log(reason);
        callback(-1);
    })
}

const acknowledgeContact = (userID, acknowledgement, contactID, callback) =>{
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    mySession.then((session) => {
        
        session.startTransaction();
        var arcDB = session.getSchema('arcturus');
        var userContactTable = arcDB.getTable("userContact");
        var userTable =arcDB.getTable("user");

        try {
            
            userContactTable.update().set(
                'statusID', acknowledgement ? status.accepted : status.rejected
                ).where(
                "userID = :userID AND contactID = :contactID"
            ).bind("userID", contactID).bind("contactID", userID).execute().then((response)=>{
                console.log(response)
                const affected = response.getAffectedItemsCount();
                if(affected > 0){
                    userTable.select(['userID', 'statusID', 'userSocket']).where('userID = :userID').bind('userID',contactID).execute().then((contactInfo)=>{
                        const infoArr = contactInfo.fetchOne();
                        const contactStatusID = infoArr[1];
                        const contactSocket = infoArr[2];

                        if (acknowledgement) {
                            userContactTable.insert(
                                ['userID', 'contactID', 'statusID']
                            ).values(
                                [userID, contactID, status.accepted]
                            ).execute().then((res) => {
                                console.log(res)
                                const insertAffected = res.getAffectedItemsCount();

                                if (insertAffected) {
                                    callback({success:true, request: acknowledgement, contactStatusID: contactStatusID, contactSocket:contactSocket})
                                    session.commit();
                                }else{
                                    callback({success:false, error:null})
                                    session.rollback()
                                }
                                
                            })
                        } else {
                            callback({ success: true, request: acknowledgement, contactStatusID: contactStatusID, contactSocket: contactSocket })
                            session.commit();
                        }

                       
                    })
                    
                   
                }else{
                    callback({success:false, error:null})
                    session.rollback()        
                }
            })
       
        } catch (error) {
           
            session.rollback()
            console.log(error)
            callback({ success:false, error:error })
        }
       
        
       
    })
}

const requestContact = (userID, contactID, msg, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    mySession.then((session) => {
    
        const checkContactQuery = "SELECT userID FROM arcturus.userContact WHERE userID = " + userID + " AND contactID = " + contactID;
        
      
        try {
            session.sql(checkContactQuery).execute().then((res)=>{
                const found = res.hasData();
                if(found){
                    console.log(results + " : " + " contact already requested.")
                    callback({requested:false, msg:"Already requested."})
                }else{
                    console.log("creating contact...")
                    session.startTransaction();
                    var arcDB = session.getSchema('arcturus');
                    var userContactTable = arcDB.getTable("userContact");

                    userContactTable.insert(
                        ['userID', 'contactID', 'statusID', 'userContactMsg']
                    ).values(
                        [userID, contactID, 3, msg]
                    ).execute().then((value) => {
                       if(value.getAffectedItemsCount() > 0){
                            session.commit();

                            const notifyQuery = "\
SELECT userSocket FROM arcturus.user WHERE userID = " + contactID + " AND user.statusID = " + status.Online;
                            
                            session.sql(notifyQuery).execute().then((onlineRes)=>{
                                let contactSocket = "";
                                if(onlineRes.hasData())
                                {
                                    contactSocket = onlineRes.fetchOne()[0];
                                    console.log("Contact request: " + userID + ":" +contactID+ "@" + contactSocket + ":" + msg)
                                   
                                }
                                
                                

                                callback({ requested: true, msg: "Contact requested.", socketID: contactSocket })

                            })
                              
                          
                            
                        }else{
                            callback({requested:false, msg:"Please try agin.", error:null})
                        }
                    })
                }
            })
            
        } catch (error) {
            console.log(error)
            session.rollback();
            callback({ requested: false, msg:"rolled back", error: error });
        }
    })
}

const findPeople = (text = "", userID = 0, callback) => {
    text = text.toLocaleLowerCase();
    text = "%" + text + "%";
    const name_email = mysql.escape(text);
    var query = "SELECT userName, userEmail, user.userID FROM arcturus.user WHERE (userName LIKE ";
    query += name_email + " OR userEmail LIKE " + name_email + ") AND user.userID <> " + userID + " AND user.userID NOT IN (\
 SELECT contactID from arcturus.userContact where userID = " + userID + " ) LIMIT 50" ;
    

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((results) => {
            if (!results.hasData()) {
              
                console.log("no users for" + text);
                callback([]);
            }else{
                
                const people = results.fetchAll();
                console.log(people)
                let tmpArray = [];

                for(let i = 0; i < people.length ; i ++)
                {
                    const person = {
                        userName: people[i][0],
                        userEmail: people[i][1],
                        userID: people[i][2],
                    }
                    console.log(person)
                    tmpArray.push(
                        person
                    )
                }

                callback(tmpArray)
            }
        })

    },(reason) => {
        console.log(reason);
    }).catch((reason) =>{
        console.log(reason);
    })

}

const updateSocketID = (userID, id) => {
    console.log("Updating user: " + userID + " socket id: " + id)
    var query = "UPDATE arcturus.user SET user.userSocket = " + mysql.escape(id) + " \
WHERE user.userID = " + userID;

    if(!util.types.isPromise(mySession)){
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((results) => {
            if(results.getAffectedItemsCount() > 0){
                console.log("socket ID updated");
            }else{
                console.log("socket ID could not be updated")
            }
        })
    })
}

function validateEmail(email ="", code ="",callback){
    email = (mysql.escape(email)).toLowerCase();;


    var query = "SELECT * FROM user WHERE (userEmail = ";
    query += email;

  
    
    sqlCon.query(query, (err, results) => {
        if (err != null || typeof results === undefined || !Array.isArray(results) || results.length != 1) {
            console.log("error")
            console.log(err);
            console.log(results);
            callback({ validate: false, status:"email" });
        } else {


            console.log(code);
            console.log(results);

            var user = results[0];
            
            console.log(user);

         

            if (user.userStatus == status && user.userVeri == veri) {
                query = "UPDATE user SET userStatus='', userVeri='' " + "WHERE userID = " + user.userID;
                sqlCon.query(query, (info, results) => {
                
                    console.log(info);
                    console.log(results);
                    if(results.affectedRows > 0){
                        callback({ validate: true, Status:"updated" });
                    }else{
                        callback({validate: true, Status:"false" });
                    }
                });
            } else {
                console.log("Wrong code:" + user.userStatus + ":" + status + "&" + user.userVeri + ":" + veri);
                callback({ validate: false, Status: "Code" });
            }
        
        }
    });
   
}

const checkEmail = (email = "", callback) => {
    email = mysql.escape(email);

    let query = "SELECT userEmail from arcturus.user WHERE userEmail = " + email;

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }


    mySession.then((mySession) => {

        mySession.sql(query).execute().then((result) => {
            console.log("has data? " + result.hasData())
            if (typeof result === undefined) {
                console.log("result undefined.");
                callback(false);
            } else if (result.hasData()) {
                console.log("email exists.");
                callback(false);
            } else {
                console.log("Email not used.")
                callback(true);
            }
        })
    }).catch((reason) => {
        console.log(reason);
        callback(false);
    })
}


const checkUserName = (name = "", callback) => {
    name = mysql.escape(name);

    let query = "SELECT userName from arcturus.user WHERE userName = " + name;

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }



    mySession.then((mySession) => {

        mySession.sql(query).execute().then((result) => {
            console.log("has data? " + result.hasData())
            if (typeof result === undefined) {
                console.log("result undefined.");
                callback(false);
            } else if (result.hasData()) {
                console.log("username exists.");
                callback(false);
            } else {
                console.log("username not used.")
                callback(true);
            }
        })
    }).catch((reason) => {
        console.log(reason);
        callback(false);
    })
}


function createUserOld(user,socketID, callback){
    var date = new Date().toString();
    var veriCode =  cryptojs.SHA256(user.userEmail+date).toString();

    var userName = mysql.escape(user.userName);
    var userPass = mysql.escape(user.userPass);
    var userEmail = mysql.escape(user.userEmail);
    var userRefID = user.userRefID;
    socketID = mysql.escape(socketID);

    


    var query = "INSERT INTO arcturus.user (userName, userPassword, userEmail, refID, statusID) ";
    query += "values (" + userName + ", " + userPass + ", " + userEmail +" , " + userRefID +" , 3 )";

  
    let userID = -1;
   
    console.log("inserting..")

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((results) => {
    
             userID = results.getAutoIncrementValue();
            console.log("new user ID: " + userID.toString());
           
            query = "INSERT INTO arcturus.userStatus (userID, statusID, userStatusCode, userStatusValidated) values ('" + userID + "', 3," + mysql.escape(veriCode) + ",'false')";
            console.log("inserting into userStatus " + query);

            mySession.sql(query).execute().then((results) => {
                let affected = results.getAffectedItemsCount();
                if (affected > 0) {
                    console.log("userStatus Insert succeeded")
                /*   emailValidateCode(user.userName,user.userEmail,veriCode,(err,info) => {
                        console.log(err);
                        console.log(info);
                    });*/
                }else{
                    console.log("userStatus Insert 0 affected rows");
                }
                
            }).catch((rejected) => {
                console.log("Could not create userStatus for: " + userName);
                console.log(rejected);
            })

        console.log("callback:")
 
        callback({create: true, msg:userName + "created"})
        

        }).catch((error) => {
            console.log(error)
            let message = "Cannot confirm. ";
            let msg = "";
            let i = 0;
            if('info' in error)
            {
                if(error.info.code == 1062)
                {
                    if('msg' in error.info){
                        msg = error.info.msg;
                        i = msg.indexOf("'",17);
                        msg = msg.substring(17,i);
                        message += msg + " already exists.";
                    }
                }else{
                    message += " We are experiencing technical issues.";
                }
            }
            console.log(message);
            callback({ create: false, msg: message })
        });
    });      
    //});
     
 
  
}

function createUser(user, callback) {
    var date = new Date().toString();
    var veriCode = cryptojs.SHA256(user.userEmail + date).toString().slice(0,8);


  
    console.log(user)

    
    console.log("inserting..")

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var userTable = arcDB.getTable("user");
        

        session.startTransaction();
        try {
            var res = userTable.insert(
                ['userName', 'userPassword', "userEmail", 'refID', 'userCode', 'statusID']
                ).values(
                    [user.userName, user.userPass, user.userEmail, user.userRefID, veriCode, 3 ]
                ).execute();
              res.then((value) => {
                var id = value.getAutoIncrementValue();
                
                const eHTML = "\
<p>" + user.userName + ",</p>\
<p>Your email verification code is: " + veriCode + "</p>\
<p>Best Regards,</p>\
<p>ArcturusRPG.io</p>"
                email(user.userEmail,"Arcturus RPG", eHTML, (err, info)=>{
                    if(err){
                        console.log(err)
                    }else{
                        console.log("Email sent to: "+ user.userEmail)
                    }
                })
                callback({ create: true, msg: id + "created" })
            }).catch((error)=>{
                console.log(error)
            })

            session.commit();

          

           
        } catch (error){
            console.log(error)
            session.rollback();
            callback({ create: false, msg:"Rolled back"});
        }
    })



}

function formatedNow(now = new Date()) {

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth()
    const day = now.getUTCDate();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const seconds = now.getUTCSeconds();


    const stringYear = year.toString();
    const stringMonth = month < 10 ? "0" + month : String(month);
    const stringDay = day < 10 ? "0" + day : String(day);
    const stringHours = hours < 10 ? "0" + hours : String(hours);
    const stringMinutes = minutes < 10 ? "0" + minutes : String(minutes);
    const stringSeconds = seconds < 10 ? "0" + seconds : String(seconds);



    return stringYear + "-" + stringMonth + "-" + stringDay + " " + stringHours + ":" + stringMinutes + ":" + stringSeconds;



   
}



const createRefCode = (user,code, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    console.log("Inserting referal code.")

    mySession.then((session) => {
        var arcDB = session.getSchema('arcturus');
        var ref = arcDB.getTable("ref");
        const now = formatedNow();

        session.startTransaction();
        try {
            //var res = 
            ref.insert(['refCode', 'userID','refCreated']).values([code, user.userID, now]).execute();
            //const refID = res.getAutoIncrementValue();

            session.commit();

            console.log("Created code: " + code + " at: " + now)

            callback(true, { refCode: code, refCreated:now })
        } catch (error) {
            console.log(error)
            session.rollback();
            callback(false, null);
        }
        emailpassrest
    }).catch((error)=>{
        console.log(error)
        callback(false, null);
    })
}

function emailPassReset(name, emailAddress, userCode, callback)
{
    

    var emailHtml = name +",<br>"; 
    emailHtml += "<br>Please use the following code: " + userCode;
    emailHtml += "<p>Regards</p>";
    emailHtml += "<p>ArcturusRPG.io</p>";


    email(emailAddress,"Arcturus.io Code",emailHtml,callback);


}

function emailValidateCode(userName ="",emailAddress ="",veriCode ="",callback){
    
    var emailHtml = "<p>Hi " + userName + ",</p>";

    emailHtml += "<p>Please click the following link to verify your email address.:</p><br>";
    emailHtml += "<h3><a href='" +homeURL + "/validate?email="+ emailAddress +",validateEmail=" + veriCode + "'>Verify Email</a></h3>";
    emailHtml += "<br><p>A verified email address will be required in order to recover your account if you lose your password.</p>"
    emailHtml += "<p>Regards</p>";
    emailHtml += "<p>Arcturus RPG</p>";
    email(emailAddress, "Arcturus RPG: Verify Email", emailHtml, callback);
 
    
  
}


function email(emailAddress, subject, emailHtml, callback)
{


    message = {
        from: emailUser,
        to: emailAddress,
        subject: subject,
        html: emailHtml
    }

    transporter.sendMail(message, (err,info) => {
        console.log("Sending email...")
        if (err) {
            console.log(err)
        } else {
            console.log(info);
        }

      
            
        callback(err,info);
        
    });


   


} 

const getContactRequests = (user, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    console.log("Getting contact requests")
    var query = "SELECT DISTINCT userContact.userID, userContact.statusID, user.userName, user.userHandle, userContact.userContactMsg, status.statusName \
FROM arcturus.userContact, arcturus.user, arcturus.status \
WHERE userContact.userID = user.userID AND userContact.contactID = " + user.userID + " AND userContact.statusID = " + status.confirming + " AND userContact.statusID = status.statusID";

    mySession.then((session) => {

        session.sql(query).execute().then((results) => {
            const found = results.hasData();
        
            if (found) {
                var contactsArray = results.fetchAll();
                var contacts = new Array();
                for (var i = 0; i < contactsArray.length; i++) {
                    contacts.push(
                        {
                            userID: contactsArray[i][0],
                            statusID: { statusID: contactsArray[i][1], statusName: contactsArray[i][5] },
                            userName: contactsArray[i][2],
                            userHandle: contactsArray[i][3],
                            userContactMsg: contactsArray[i][4],
                        }
                    )
                }
                console.log("Requests: " + contacts)
                callback(contacts)
            }
            else {
                console.log("No contact requests found")
                callback([])
            }
        })
    })
}

const getContacts = (user, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    var query = "SELECT DISTINCT userContact.contactID, userContact.statusID, user.userName, user.userHandle, status.statusName \
FROM arcturus.userContact, arcturus.user, arcturus.status \
WHERE userContact.userID = " +user.userID + " AND user.userID = userContact.contactID AND userContact.statusID = status.statusID"

    console.log("getting contacts")

    mySession.then((session) => {
    
        session.sql(query).execute().then((results)=>{
            const found = results.hasData();
         
            if(found){
                var contactsArray = results.fetchAll();
                var contacts = new Array();
                for(var i = 0 ; i < contactsArray.length ; i++)
                {
                    contacts.push(
                        {
                            userID: contactsArray[i][0],
                            status: {statusID: contactsArray[i][1], statusName:contactsArray[i][4]},
                            userName: contactsArray[i][2],
                            userHandle: contactsArray[i][3]
                        }
                    )
                }
                console.log("Contacts: ")
                console.log(contacts)
                callback(contacts)
            }
            else{
                callback([])
            }
        })
    }).catch((error)=>{
        console.log(error);
    })
}

const getUserInformation = (loginUser, callback) => {


    if (loginUser != null) {
        
        getCampaigns(loginUser.userID, (campaigns) => {
            callback(true, {
                campaigns:campaigns
            })
        })

    } else { callback(false, null) }
}

function formatedTime(mySqlTime) {
  

    if(mySqlTime == null)
    {
        return "0000-00-00 00:00:00";
    }else{
       /* const str = String(mySqlTime);

        const dateTime = str.split("T");
        const date = dateTime[0];
        const time = dateTime[1].slice(0,7)

        return date + " " + time */
        

        return formatedNow(new Date(mySqlTime))
    }

    
}

const getUserReferalCodes = (user, callback) => {
    const userID = user.userID;

    var query = "select DISTINCT ref.refID, refCode, refCreated FROM arcturus.ref, arcturus.user WHERE ref.userID = " + userID + " AND ref.refID NOT IN (select refID from arcturus.user)" ;

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((session) => {
        session.sql(query).execute().then((results) => {
            if(results.hasData())
            {
                const codesArr = results.fetchAll();
                let result = [];

                for(let i = 0; i < codesArr.length ; i++)
                {
                    result.push(
                        {
                            refID: codesArr[i][0],
                            refCode: codesArr[i][1],
                            refCreated: formatedTime(codesArr[i][2])
                        }
                    )
                }

                callback({success: true, result: result})
            }else{
                callback({sucess: false, rejected:false, error:null})
            }
        })
    }).catch((error)=>{
        console.log(error);
        callback({sucess: false, rejected:true, error:error})
    })
}

const checkUser = (user, callback) => {
    var name_email = (mysql.escape(user.nameEmail));
    var pass = (mysql.escape(user.password));

    var query = "SELECT DISTINCT userID, userName, userEmail, userHandle, imageID FROM arcturus.user WHERE ( LOWER(userName) = \
LOWER( " + name_email + ") OR LOWER(userEmail) = LOWER(" + name_email + ")) AND userPassword = " + pass;

  

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((session) => {

        session.sql(query).execute().then((results) => {
            if (!results.hasData()) {

                console.log("login try failed for: " + name_email)

                callback(false, null)
            } else {


                const userArr = results.fetchOne()

                const userID = userArr[0];
                    
                    const loginUser = {
                        userID: userID,
                        userName: userArr[1],
                        userEmail: userArr[2],
                        userHandle: userArr[3],
                    }

                   

                    callback(true, loginUser);

             //   })
                
            }
        })
    }).catch((reason) => {
        console.log(reason);
        callback(false, null)
    })
}

const sendRecoveryEmail = (email, callback) => {
    var date = new Date().toString();
    var veriCode = cryptojs.SHA256(date).toString().slice(0,6);
    
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var userTable = arcDB.getTable("user");


        session.startTransaction();
        try {

            var res = userTable.select(['userName','userID']).where("userEmail = :userEmail").bind("userEmail", email).execute();
            res.then((value) => {
                const row = value.fetchOne();
                console.log(row)
                const userName = row[0];
                const userID = row[1];

                const modifiedString = formatedNow();
            
                userTable.update().set(
                    'userRecoveryCode', veriCode
                ).set(
                    'userModified', modifiedString
                ).where(
                    "userID = :userID"
                ).bind("userID", userID).execute().then((res)=>{
                    if(res.getAffectedItemsCount() > 0){
                        emailPassReset(userName, email, veriCode, (err, info) => {
                            if (err) {
                                throw("unable to send email")
                            } else {
                                callback({success:true})
                            }
                        })
                    }else{
                        throw("unable to update user")
                    }
                })

                session.commit();
           
            })
        } catch (error) {
            console.log(error)
            session.rollback();
            callback({ success: false, msg: error });
        }
    })
}

const updateUserPassword = (info, callback) => {
    console.log("update password")
    console.log(info)
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var userTable = arcDB.getTable("user");
        const modifiedString = formatedNow();
        const password = info.password;
        const userEmail = info.email;
        const code = info.code;

        session.startTransaction();
        try {
            userTable.update().set(
                'userPassword', password
            ).set(
                'userModified', modifiedString
            ).where(
                "userEmail = :userEmail AND userRecoveryCode = :code"
            ).bind(
                "userEmail", userEmail
            ).bind(
                "code", code
            ).execute().then((result)=>{
                const affected = result.getAffectedItemsCount()
                if(affected > 0)
                {
                    callback({success:true})
                }else{
                    callback({success:false})
                }
            })
        } catch (error) {
            console.log(error)
            session.rollback();
            callback({ success: false, msg: error });
        }
    })
}