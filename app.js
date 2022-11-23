const nodemailer = require('nodemailer');
const mysql = require('mysql2');
const mysqlx = require('@mysql/xdevapi');
const fs = require('fs');
const cryptojs = require('crypto-js');
const util = require('util');
const { homeURL, socketURL, wwwURL, server, dbURL, dbPort, sqlCred, emailUser, emailPassword, authToken, loginToken } = require('./httpVars');


const adminAddress = emailUser;


const io = require('socket.io')(server, {
    cors: {
        origin: [homeURL, wwwURL, socketURL],
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


const pingAlive = () => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((session) => {

        const arcDB = session.getSchema("arcturus");
        const keepAliveTable = arcDB.getTable("keepAlive");

        keepAliveTable.select(["keepAliveValue"]).where("keepAliveID = 1").execute().then((res) =>{
            const keepAliveValue = res.fetchOne();
            if (keepAliveValue != undefined){
                console.log(keepAliveValue[0]);
            }else{
                console.log(0)
            }
        }).catch((err)=>{
            console.log("KeepAlive error: ")
            console.log(err)
        })
       
    })
    setTimeout(pingAlive, 100000);
}

pingAlive();


io.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
});
const advisory = {
    none: -1,
    general: 0,
    mature: 1,
    adult: 2
}
const status = {
    valid: 1,
    invalid: 2,
    confirming: 3,
    Offline: 4,
    Online: 5,
    rejected: 6,
    accepted: 7
}
const access = {
    private: 0,
    contacts: 1,
    public: 2,
}

io.on('connection', (socket) => {
    const id = socket.id;
    if (socket.handshake.auth.token == authToken) {
        
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
            socket.on("sendRecoveryEmail", (email, callback) => {
                sendRecoveryEmail(email, (sent) => {
                    callback(sent)
                })
            })
            socket.on("updateUserPassword", (info, callback) => {
                updateUserPassword(info, (result) => {
                    callback(result)
                })
            })
        } else if(socket.handshake.auth.token == loginToken) {
            socket.on("login", (params, callback)=>{
             
                console.log(params)
                checkUser(params, (success, loginUser) => {
                    console.log("logged in " + success)
                    if (!success) {
                        callback({success:false})
                        socket.disconnect()
                    }else if(success){
                       
                        const user = loginUser;
                       

                        updateUserStatus(user.userID, status.Online, id, (isRooms, rooms) => {
                            if (isRooms) {
                                for (let i = 0; i < rooms.length; i++) {

                                    console.log("sending userStatus message to: " + rooms[i][0] + " user: " + user.userID + " is: Online");

                                    io.to(rooms[i][0]).emit("userStatus", user.userID, user.userName, "Online");

                                }
                            }

                        })
                    
                        getContacts(user, (contacts) => {
                            getContactRequests(user, (requests => {
                                callback({ success: true, user:loginUser, contacts:contacts, requests:requests })
                            }))
                        })
              
               
                /* //////////////SUCCESS///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/

              
                    socket.on("enterRealmGateway", (realmID, callback)=>{
                        enterRealmGateway(user, realmID,socket, (enteredGateway)=>{
                            callback(enteredGateway)
                        })
                    })
                  
                    socket.on("checkRealmName", (name, callback)=>{
                        checkRealmName(name, callback)
                    })

                    socket.on("createRealm", (realmName, imageFile, page, index, callback) =>{
                        createRealm(user.userID, realmName, imageFile, page, index, (created) =>{
                            callback(created)
                        })
                    })

                    socket.on("deleteRealm", (realmID, callback) =>{
                        deleteRealm(user.userID,realmID,(result) =>{
                            if(!("error" in result)){
                                if(result.success)
                                {
                                    result.realmUsers.forEach(user => {
                                        getUserSocket(user.userID, (userSocket)=>{     
                                            if(userSocket != null) io.to(userSocket).emit("realmDelete", realmID)
                                        }) 
                                    });
                                }
                            }
                            callback(result)
                        })
                    })

                    socket.on("getRealms", (callback)=>{
                        getRealms(user.userID, (realms)=>{
                            callback(realms)
                        })
                    })

                    socket.on("updateRealmInformation", (information, callback)=>{
                        updateRealmInformation(information, (result)=>{
                            callback(result)
                        })
                    })
                     
             

                    socket.on("requestContact", (contactID, msg, callback) => {
                        const userID = user.userID;
                        requestContact(userID, contactID, msg, (result) => {
                            const contactSocketID = result.socketID
                            if (contactSocketID != "") {
                                io.to(contactSocketID).emit("requestContact", userID, msg)
                            }
                            callback(result)
                        })
                    })

                    socket.on("acknowledgeContact", (response, contactID, callback) => {
                        const userID = user.userID;

                        acknowledgeContact(userID, response, contactID, (result) => {
                            callback(result)
                        })
                    })

                    socket.on('createRefCode', (code, callback) => {
                        createRefCode(user, code, (created, result) => {
                            callback(created, result)
                        })
                    })

                    socket.on("getUserReferalCodes", (callback) => {
                        getUserReferalCodes(user, (result) => {
                            callback(result)
                        })
                    })

                   /* socket.on('getUserInformation', (userInformation) => {
                        console.log(user)
                        if (user != null) {
                            getUserInformation(user, (info) => {
                                userInformation(info);
                            })
                        }
                    })*/
                    socket.on("createStorage", (fileInfo, engineKey,  callback) => {
                     
                        createStorage(user.userID, fileInfo, engineKey,  (created) => {
                            callback(created)
                        })
                    })

                    socket.on("useConfig", (fileID, storageKey, callback)=>{
                        useConfig(user.userID, fileID, storageKey, (success)=>{
                            callback(success)
                        })
                    })

                    socket.on("checkStorageCRC", (crc, callback) =>{
                        checkStorageCRC(user.userID, crc, (result)=>{
                            callback(result)
                        })
                    })

                    socket.on("loadStorage", (crc, engineKey, callback) => {

                        loadStorage(crc, engineKey, (storage)=>{
                            callback(storage)
                        })

                    })

                    socket.on("updateStorageConfig", (fileID, fileInfo, callback)=>{
                        updateStorageConfig(fileID, fileInfo, (result)=>{
                            callback(result)
                        })
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

                    socket.on("updateUserPeerID", (peerID, callback) => {
                       console.log("updatingPeerID: " + peerID)
                        updateUserPeerID(user.userID, peerID, (result)=>{
                            callback(result)
                        })
                    })

                  


                    socket.on('disconnect', () => {
                        const userName = user.userName;
                        const userID = user.userID;
                        if (userID > 0) {
                            cleanRooms(userID, (roomCount) => {
                                console.log("cleaned " + roomCount + " rooms, disconnecting user " + userName);
                            });
                        }
                    });


                } 
            });
    })
    
      
}else{
    socket.disconnect()
}

})

    /* */



function CapFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}


const createRoom = (roomTable, userRoomTable, userID, roomName) => {
    return new Promise(resolve => {
   
            roomTable.insert(["roomName", "adminID"]).values(roomName, userID).execute().then((roomCreated) => {
                const roomID = roomCreated.getAutoIncrementValue();

                userRoomTable.insert(["userID","roomID", "statusID"]).values(userID,roomID, status.Offline).execute().then((userRoomInsert)=>{
                        resolve(
                            {
                            success: true,
                            room:{
                                roomID: roomID,
                                roomName: roomName,
                                adminID: userID 
                            },
                            addedUser: userRoomInsert.getAffectedItemsCount() > 0
                        }
                        )
                })

               
            })

    })
}



const addUserToRoom = (userTable, userRoomTable, fileTable, userID , roomID) => {
   return new Promise(resolve => {
        userRoomTable.insert(["userID", "roomID"]).values(userID, roomID).execute().then((userAddedToRoom) => {
                const affected = userAddedToRoom.getAffectedItemsCount() > 0;
                if (affected) {
                    getUserInformation(userTable, fileTable, userID).then((userInformation)=>{
                        io.to(gatewayRoomID).emit("addedUserRoom", userInformation);
                    })   
                }
                resolve(affected)
        })
   })
}

const updateUserStatus = (userID = -1, statusID = 5, socketID = "", callback) => {
    let query = "UPDATE arcturus.user SET user.userSocket = " + mysql.escape(socketID) + "\
, user.statusID = " + statusID + " WHERE userID =" + userID;



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
            } else {
                callback(false, 0);
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

            if (result.hasData()) {
                callback(user[0], user[1])
            } else {
                callback(-1);
            }
        })
    })

}

const cleanRooms = (userID = 0, callback) => {
  
    if(userID > 0){
        mySession.then((session) => {
            const arcDB = session.getSchema("arcturus")
            const userRoomTable = arcDB.getTable("userRoom")
            const userTable = arcDB.getTable("user")

            userTable.select(["userPeerID"]).where("userID = :userID").bind("userID", userID).execute().then((userTableSelect)=>{
                const one = userTableSelect.fetchOne()
                const userPeerID = one[0];

                if(userPeerID != "" || userPeerID != null){
                    updateUserPeerID(userID, "", (callback)=>{
                        console.log(callback)
                    })
                }
            })
            userRoomTable.select(["roomID"]).where("userID = :userID and statusID <> " + status.Offline).bind("userID", userID).execute().then((userRoomSelect) => {
            
                const allRooms = userRoomSelect.fetchAll();
                if (allRooms != undefined){
                    userRoomTable.update().set("statusID", status.Offline).where("userID = :userID").bind("userID", userID).execute().then((userRooms) => {
                        const roomsAffected = userRooms.getAffectedItemsCount();
                        if(roomsAffected > 0){
                            
                                allRooms.forEach(room => {
                                    const roomID = room[0];
                                    console.log("sending userStatus message to: " + roomID + " user: " + userID + " is: Offline");
                                    io.to(roomID).emit("userStatus", userID, status.Offline);
                                });
                                callback(roomsAffected);
                        
                                
                        }else{
                            callback(roomsAffected);
                        }   
                    })
                }else{
                    callback(0)
                }
            })
        })
    }else{
        callback(0)
    }
  
}




const setUserRoomStatus = (userRoomTable, userID , roomID, statusID = 4) => {
 
return new Promise(resolve =>{


        userRoomTable.update().set("statusID", statusID).where("userID = :userID AND roomID = :roomID").bind("userID", userID).bind("roomID", roomID).execute().then((results) => {
            affectedRows = results.getAffectedItemsCount();

            if (affectedRows > 0) {
                resolve({success:true});
            } else {
                resolve({success:false});
            }
        })

})
}

const getRoomUsers = (userRoomTable, userTable, fileTable, roomID) => {
    return new Promise(resolve => {
       
            userRoomTable.select(["userID", "statusID"]).where("roomID = :roomID").bind("roomID", roomID).execute().then((userRoomSelect)=>{
               
                    const all = userRoomSelect.fetchAll()

                    if (all != undefined){
                        
                        let roomUsers = []
                        let i = 0;
                        const recursiveInformation = () =>{
                        
                            if (i < all.length) {

                                const roomUser = all[i]
                                const userID = roomUser[0]
                                const statusID = roomUser[1]

                                getUserInformation(userTable, fileTable, userID).then((userInformation)=>{
                                    userInformation.roomStatusID = statusID;
                                    roomUsers.push(userInformation)
                                })
                                i++; 
                                recursiveInformation()

                        } else {
                                resolve({ success: true, users: roomUsers })
                            }
                        }

                        recursiveInformation()
                
                    }else{
                        resolve({success:false, users:[]})
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
            if (affected > 0) {
                callback(true);
            } else {
                callback(false);
            }
        })
    }).catch((reason) => {
        callback(false);
    })
}

const getStoredMessages = (messageTable, roomID) => {

    return new Promise(resolve =>{
        messageTable.select(["messageID", "userID", "messageType", "messageText", "messageTime"]).where("roomID = :roomID").orderBy(["messageTime DESC"]).limit(30).bind("roomID", roomID).execute().then((result) => {
          
            
            const all = result.fetchAll()

            if (all != undefined) {
                let messages = []
                for(let i = all.length -1 ; i > -1 ; i--)
                {
                    messages.push({
                        messageID: all[i][0],
                        userID: all[i][1],
                        messageType: all[i][2],
                        messageText: all[i][3],
                        messageTime: all[i][4],
                    })
                }
                
                resolve({success:true, messages:messages});
            } else {
                callback({success:false, messages:[]});
            }

        })

    })
}

const checkReferral = (code = "", callback) => {
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
            } else if (result.hasData()) {
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
                        if (typeof results2 === undefined) {
                            callback(-1);
                        } else {
                            console.log("refID not used sending to callback.")
                            callback(refID);
                        }
                    }
                }).catch((reason) => {
                    console.log(reason);
                    callback(-1);
                })
            } else {
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

const acknowledgeContact = (userID, acknowledgement, contactID, callback) => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }
    mySession.then((session) => {

        session.startTransaction();
        var arcDB = session.getSchema('arcturus');
        var userContactTable = arcDB.getTable("userContact");
        var userTable = arcDB.getTable("user");
        const fileTable = arcDB.getFile("file");
        try {

            userContactTable.update().set(
                'statusID', acknowledgement ? status.accepted : status.rejected
            ).where(
                "userID = :userID AND contactID = :contactID"
            ).bind("userID", contactID).bind("contactID", userID).execute().then((response) => {
                console.log(response)
                const affected = response.getAffectedItemsCount();

                userContactTable.insert(
                    ['userID', 'contactID', 'statusID']
                ).values(
                    [userID, contactID, acknowledgement ? status.accepted : status.rejected]
                ).execute().then((res) => {
                    const affected2 = res.getAffectedItemsCount()
                if (affected > 0 && affected2 > 0) {
                    getUserInformation(userTable, fileTable, contactID).then((contact) => {
                    
                        if (acknowledgement) {
                 
                            getUserInformation(userTable, fileTable, userID).then((user) => {

                                io.to(contact.userSocket).emit("acknowledgeContact", {acknowledgement:acknowledgement, contact:user})
                            
                            })
                                
                            callback({ 
                                acknowledgement: acknowledgement, 
                                success:true,
                                contact: contact,
                            })

                            session.commit();
                         } else {

                            io.to(contact.userSocket).emit("acknowledgeContact", { acknowledgement: false })

                            callback({ success: true, acknowledgement: false })
                            session.commit();
                        }  
                    })
                      
              
                } else {
                    console.log("userContact tables could not insert / update")
                    callback({ success: false })
                    session.rollback()
                }
                })
            })
        } catch (error) {

            session.rollback()
            console.log(error)
            callback({ error: error })
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
            session.sql(checkContactQuery).execute().then((res) => {
                const found = res.hasData();
                if (found) {
                    console.log(results + " : " + " contact already requested.")
                    callback({ requested: false, msg: "Already requested." })
                } else {
                    console.log("creating contact...")
                    session.startTransaction();
                    var arcDB = session.getSchema('arcturus');
                    var userContactTable = arcDB.getTable("userContact");

                    userContactTable.insert(
                        ['userID', 'contactID', 'statusID', 'userContactMsg']
                    ).values(
                        [userID, contactID, 3, msg]
                    ).execute().then((value) => {
                        if (value.getAffectedItemsCount() > 0) {
                            session.commit();

                            const notifyQuery = "\
SELECT userSocket FROM arcturus.user WHERE userID = " + contactID + " AND user.statusID = " + status.Online;

                            session.sql(notifyQuery).execute().then((onlineRes) => {
                                let contactSocket = "";
                                if (onlineRes.hasData()) {
                                    contactSocket = onlineRes.fetchOne()[0];
                                    console.log("Contact request: " + userID + ":" + contactID + "@" + contactSocket + ":" + msg)

                                }



                                callback({ requested: true, msg: "Contact requested.", socketID: contactSocket })

                            })



                        } else {
                            callback({ requested: false, msg: "Please try agin.", error: null })
                        }
                    })
                }
            })

        } catch (error) {
            console.log(error)
            session.rollback();
            callback({ requested: false, msg: "rolled back", error: error });
        }
    })
}

const findPeople = (text = "", userID = 0, callback) => {
    text = text.toLocaleLowerCase();
    text = "%" + text + "%";
    const name_email = mysql.escape(text);
    var query = "SELECT userName, userEmail, user.userID FROM arcturus.user WHERE (userName LIKE ";
    query += name_email + " OR userEmail LIKE " + name_email + ") AND user.userID <> " + userID + " AND user.userID NOT IN (\
 SELECT contactID from arcturus.userContact where userID = " + userID + " ) LIMIT 50";


    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((results) => {
            if (!results.hasData()) {

                console.log("no users for" + text);
                callback([]);
            } else {

                const people = results.fetchAll();
                console.log(people)
                let tmpArray = [];

                for (let i = 0; i < people.length; i++) {
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

    }, (reason) => {
        console.log(reason);
    }).catch((reason) => {
        console.log(reason);
    })

}

const updateSocketID = (userID, id) => {
    console.log("Updating user: " + userID + " socket id: " + id)
    var query = "UPDATE arcturus.user SET user.userSocket = " + mysql.escape(id) + " \
WHERE user.userID = " + userID;

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((mySession) => {

        mySession.sql(query).execute().then((results) => {
            if (results.getAffectedItemsCount() > 0) {
                console.log("socket ID updated");
            } else {
                console.log("socket ID could not be updated")
            }
        })
    })
}

function validateEmail(email = "", code = "", callback) {
    email = (mysql.escape(email)).toLowerCase();;


    var query = "SELECT * FROM user WHERE (userEmail = ";
    query += email;



    sqlCon.query(query, (err, results) => {
        if (err != null || typeof results === undefined || !Array.isArray(results) || results.length != 1) {
            console.log("error")
            console.log(err);
            console.log(results);
            callback({ validate: false, status: "email" });
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
                    if (results.affectedRows > 0) {
                        callback({ validate: true, Status: "updated" });
                    } else {
                        callback({ validate: true, Status: "false" });
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


function createUserOld(user, socketID, callback) {
    var date = new Date().toString();
    var veriCode = cryptojs.SHA256(user.userEmail + date).toString();

    var userName = mysql.escape(user.userName);
    var userPass = mysql.escape(user.userPass);
    var userEmail = mysql.escape(user.userEmail);
    var userRefID = user.userRefID;
    socketID = mysql.escape(socketID);




    var query = "INSERT INTO arcturus.user (userName, userPassword, userEmail, refID, statusID) ";
    query += "values (" + userName + ", " + userPass + ", " + userEmail + " , " + userRefID + " , 3 )";


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
                } else {
                    console.log("userStatus Insert 0 affected rows");
                }

            }).catch((rejected) => {
                console.log("Could not create userStatus for: " + userName);
                console.log(rejected);
            })

            console.log("callback:")

            callback({ create: true, msg: userName + "created" })


        }).catch((error) => {
            console.log(error)
            let message = "Cannot confirm. ";
            let msg = "";
            let i = 0;
            if ('info' in error) {
                if (error.info.code == 1062) {
                    if ('msg' in error.info) {
                        msg = error.info.msg;
                        i = msg.indexOf("'", 17);
                        msg = msg.substring(17, i);
                        message += msg + " already exists.";
                    }
                } else {
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
    var veriCode = cryptojs.SHA256(user.userEmail + date).toString().slice(0, 8);



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
                ['userName', 'userPassword', "userEmail", 'refID', 'userCode', 'statusID', "imageID"]
            ).values(
                [user.userName, user.userPass, user.userEmail, user.userRefID, veriCode, 3, -1]
            ).execute();
            res.then((value) => {
                var id = value.getAutoIncrementValue();

                const eHTML = "\
<p>" + user.userName + ",</p>\
<p>Your email verification code is: " + veriCode + "</p>\
<p>Best Regards,</p>\
<p>ArcturusRPG.io</p>"
                email(user.userEmail, "Arcturus RPG", eHTML, (err, info) => {
                    if (err) {
                        console.log(err)
                    } else {
                        console.log("Email sent to: " + user.userEmail)
                    }
                })
                callback({ create: true, msg: id + "created" })
            }).catch((error) => {
                console.log(error)
            })

            session.commit();




        } catch (error) {
            console.log(error)
            session.rollback();
            callback({ create: false, msg: "Rolled back" });
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



const createRefCode = (user, code, callback) => {
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
            ref.insert(['refCode', 'userID', 'refCreated']).values([code, user.userID, now]).execute();
            //const refID = res.getAutoIncrementValue();

            session.commit();

            console.log("Created code: " + code + " at: " + now)

            callback(true, { refCode: code, refCreated: now })
        } catch (error) {
            console.log(error)
            session.rollback();
            callback(false, null);
        }
        emailpassrest
    }).catch((error) => {
        console.log(error)
        callback(false, null);
    })
}

function emailPassReset(name, emailAddress, userCode, callback) {


    var emailHtml = name + ",<br>";
    emailHtml += "<br>Please use the following code: " + userCode;
    emailHtml += "<p>Regards</p>";
    emailHtml += "<p>ArcturusRPG.io</p>";


    email(emailAddress, "Arcturus.io Code", emailHtml, callback);


}

function emailValidateCode(userName = "", emailAddress = "", veriCode = "", callback) {

    var emailHtml = "<p>Hi " + userName + ",</p>";

    emailHtml += "<p>Please click the following link to verify your email address.:</p><br>";
    emailHtml += "<h3><a href='" + homeURL + "/validate?email=" + emailAddress + ",validateEmail=" + veriCode + "'>Verify Email</a></h3>";
    emailHtml += "<br><p>A verified email address will be required in order to recover your account if you lose your password.</p>"
    emailHtml += "<p>Regards</p>";
    emailHtml += "<p>Arcturus RPG</p>";
    email(emailAddress, "Arcturus RPG: Verify Email", emailHtml, callback);



}


function email(emailAddress, subject, emailHtml, callback) {


    message = {
        from: emailUser,
        to: emailAddress,
        subject: subject,
        html: emailHtml
    }

    transporter.sendMail(message, (err, info) => {
        console.log("Sending email...")
        if (err) {
            console.log(err)
        } else {
            console.log(info);
        }



        callback(err, info);

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
WHERE userContact.userID = " + user.userID + " AND user.userID = userContact.contactID AND userContact.statusID = status.statusID"

    console.log("getting contacts")

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
                            status: { statusID: contactsArray[i][1], statusName: contactsArray[i][4] },
                            userName: contactsArray[i][2],
                            userHandle: contactsArray[i][3]
                        }
                    )
                }
                console.log("Contacts: ")
                console.log(contacts)
                callback(contacts)
            }
            else {
                callback([])
            }
        })
    }).catch((error) => {
        console.log(error);
    })
}

const getUserInformation = (userTable,fileTable, userID) => {
    return new Promise(resolve =>{
        userTable.select(["userID", "userName", "userHandle", "userSocket", "statusID", "imageID"]).where("userID = :userID").bind("userID", userID).execute().then((userSelect)=>{
            const one = userSelect.fetchOne()

            if(one != undefined)
            {
                const imageID = one[5];
                if(imageID == -1){
                    resolve({
                        userID: one[0],
                        userName: one[1],
                        userHandle: one[2],
                        userSocket: one[3],
                        statusID: one[4],
                        image: {
                            fileID: -1,
                            fileName: null,
                            fileType: null,
                            fileCRC: null,
                            fileMimeType: null,
                            fileSize: null,
                            fileLastModified: null
                        }
                    })
                }else{
                    fileTable.select(["fileID", "fileName", "fileType", "fileCRC", "fileMimeType", "fileSize", "fileLastModified"]).where("fileID = :fileID and fileMimeType = 'image'").bind("fileID", imageID).execute().then((fileResult) => {
                        const oneFile = fileResult.fetchOne()

                        if(oneFile != undefined){
                            const image = {
                                fileID: oneFile[0],
                                fileName: oneFile[1],
                                fileType: oneFile[2],
                                fileCRC: oneFile[3],
                                fileMimeType: oneFile[4],
                                fileSize: oneFile[5],
                                fileLastModified: oneFile[6]
                            }
                            resolve({
                                userID: one[0],
                                userName: one[1],
                                userHandle: one[2],
                                userSocket: one[3],
                                statusID: one[4],
                                image: image
                            })
                        }else{
                            resolve({
                                userID: one[0],
                                userName: one[1],
                                userHandle: one[2],
                                userSocket: one[3],
                                statusID: one[4],
                                image: {
                                    fileID: -1,
                                    fileName: null,
                                    fileType: null,
                                    fileCRC: null,
                                    fileMimeType: null,
                                    fileSize: null,
                                    fileLastModified: null
                                }
                            })
                        }
                    })
                }  
            }else{
                throw new Error("Not a user")
            }
        })

    })
}

function formatedTime(mySqlTime) {


    if (mySqlTime == null) {
        return "0000-00-00 00:00:00";
    } else {
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

    var query = "select DISTINCT ref.refID, refCode, refCreated FROM arcturus.ref, arcturus.user WHERE ref.userID = " + userID + " AND ref.refID NOT IN (select refID from arcturus.user)";

    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCredentials)
    }

    mySession.then((session) => {
        session.sql(query).execute().then((results) => {
            if (results.hasData()) {
                const codesArr = results.fetchAll();
                let result = [];

                for (let i = 0; i < codesArr.length; i++) {
                    result.push(
                        {
                            refID: codesArr[i][0],
                            refCode: codesArr[i][1],
                            refCreated: formatedTime(codesArr[i][2])
                        }
                    )
                }

                callback({ success: true, result: result })
            } else {
                callback({ sucess: false, rejected: false, error: null })
            }
        })
    }).catch((error) => {
        console.log(error);
        callback({ sucess: false, rejected: true, error: error })
    })
}

const checkUser = (user, callback) => {
    var name_email = (mysql.escape(user.nameEmail));
    var pass = (mysql.escape(user.password));

    var query = `SELECT DISTINCT userID, userName, userEmail, userHandle, imageID, fileName, fileType, fileCRC, fileMimeType, fileSize, fileLastModified \
FROM arcturus.user, arcturus.file \
WHERE \
 ( LOWER(userName) = LOWER( ${name_email}) OR LOWER(userEmail) = LOWER(${name_email})) AND userPassword = ${pass} AND \
 fileID = imageID`;



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
                    image:{
                        imageID:userArr[4],
                        name: userArr[5], 
                        type: userArr[6], 
                        crc: userArr[7], 
                        mimeType: userArr[8], 
                        size: userArr[9], 
                        lastModified: userArr[10]
                    }
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
    var veriCode = cryptojs.SHA256(date).toString().slice(0, 6);

    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var userTable = arcDB.getTable("user");


        session.startTransaction();
        try {

            var res = userTable.select(['userName', 'userID']).where("userEmail = :userEmail").bind("userEmail", email).execute();
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
                ).bind("userID", userID).execute().then((res) => {
                    if (res.getAffectedItemsCount() > 0) {
                        emailPassReset(userName, email, veriCode, (err, info) => {
                            if (err) {
                                throw ("unable to send email")
                            } else {
                                callback({ success: true })
                            }
                        })
                    } else {
                        throw ("unable to update user")
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
            ).execute().then((result) => {
                const affected = result.getAffectedItemsCount()
                if (affected > 0) {
                    callback({ success: true })
                } else {
                    callback({ success: false })
                }
            })
        } catch (error) {
            console.log(error)
            session.rollback();
            callback({ success: false, msg: error });
        }
    })
}

const updateStorageConfig = (fileID, fileInfo, callback) =>{
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var fileTable = arcDB.getTable('file')

        fileTable.update().set(
            "fileName", fileInfo.name
        ).set(
            "fileCRC", fileInfo.crc
        ).set(
            "fileSize", fileInfo.size
        ).set(
            "fileType", fileInfo.type
        ).set(
            "fileMimeType", fileInfo.mimeType
        ).set(
            "fileLastModified", fileInfo.lastModified
        ).where("fileID = :fileID").bind(
            "fileID", fileID
        ).execute().then((fileUpdateResult)=>{
            const result = fileUpdateResult.getAffectedItemsCount()

            callback({success:result > 0})
        }).catch((err)=>{
            console.log(err);
            callback({error: new Error("DB error")})
        })
      
    })
}
const createStorage = (userID, fileInfo, storageKey, callback ) =>{


    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var storageTable = arcDB.getTable("storage");
        var fileTable = arcDB.getTable("file")
   
        console.log(fileInfo)

        fileTable.insert(
            ["fileName", "fileCRC", "fileSize", "fileType", "fileMimeType" , "fileLastModified"]
        ).values(
            [fileInfo.name, fileInfo.crc, fileInfo.size, fileInfo.type, fileInfo.mimeType, fileInfo.lastModified]
        ).execute().then((fileInsert)=>{
            if(fileInsert.getAffectedItemsCount > 0){
                callback({error:new Error("File not added.")})
            }else{
                const fileID = fileInsert.getAutoIncrementValue()
                console.log(fileID)
                storageTable.insert(
                    ['storageKey', "statusID", "fileID", "userID"]
                ).values(
                    [storageKey, status.Offline, fileID, userID]
                ).execute().then((res) => {
                    const affected = res.getAffectedItemsCount();

                    if(affected > 0)
                    {
                        const storageID = res.getAutoIncrementValue()

                        callback({success:true, storageID: storageID, fileID: fileID})
                    }else{
                        callback({success:false})
                    }
                    
                }).catch((err) => {
                    console.log(err)

                    callback({error:new Error("Storage not created")})
                })
            }
        }).catch((err) =>{
            console.log(err)
            callback({ error: new Error("Storage not created") })
        })
       
        
       
    }).catch((err) => {
        console.log(err)
        callback({ error: new Error("Storage not created") })
    })
}

const loadStorage = (crc, engineKey, callback) => {
    crc = mysql.escape(crc);
    engineKey = mysql.escape(engineKey);

    mySession.then((session) => {
        const query = "select storage.storageID, storage.fileID from arcturus.storage, arcturus.file where file.fileCRC = " + crc + " \
AND storage.storageKey = " + engineKey;

        session.sql(query).execute().then((loaded)=>{
            if(loaded.hasData())
            {
                const info = loaded.fetchOne();
                const storageID = info[0];
                const fileID = info[1];

                callback({ success: true, storageID: storageID, fileID: fileID })
            }else{
                callback({ error: new Error("No storage.") })
            }
        })
    }).catch((err)=>{
        console.log(err)
        callback({error: new Error("DB error")})
    })

}






function formatedNow(now = new Date(), small = false) {

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth()
    const day = now.getUTCDate();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const seconds = now.getUTCSeconds();
    const miliseconds = now.getUTCMilliseconds();

    const stringYear = year.toString();
    const stringMonth = month < 10 ? "0" + month : String(month);
    const stringDay = day < 10 ? "0" + day : String(day);
    const stringHours = hours < 10 ? "0" + hours : String(hours);
    const stringMinutes = minutes < 10 ? "0" + minutes : String(minutes);
    const stringSeconds = seconds < 10 ? "0" + seconds : String(seconds);
    const stringMiliseconds = miliseconds < 100 ? (miliseconds < 10 ? "00" + miliseconds : "0" + miliseconds) : String(miliseconds);


   return  stringNow = stringYear + "-" + stringMonth + "-" + stringDay + " " + stringHours + ":" + stringMinutes;



    
}

const checkStorageCRC = (userID, crc, callback) =>{

    mySession.then((session) => {
      
        const arcDB = session.getSchema("arcturus");
        const fileTable = arcDB.getTable("file");
        const storageTable = arcDB.getTable("storage");


        fileTable.select(["fileID"]).where("fileCRC = :fileCRC").bind("fileCRC", crc).execute().then((fileResult)=>{

            const one = fileResult.fetchOne()
            if(one != undefined)
            {
                const fileID = one[0];
                
                storageTable.select(["storageID"]).where("fileID = :fileID AND userID = :userID").bind("fileID", fileID).bind("userID",userID).execute().then((storageResult)=>{
                    
                    const row = storageResult.fetchOne()

                    if(row != undefined){
                        const storageID = row[0];
                        console.log("storageCRC passed")
                        callback({ success: true, fileID: fileID, storageID: storageID })
                    }else{
                        console.log("no storage ID for file")
                        callback({ success: false, fileID: fileID, storageID: null })
                    }    
                
                }).catch((err)=>{
                    console.log(err)
                    callback({ error: new Error("DB error") })
                })


            }else{
                callback({error:new Error("File CRC failed.")})
            }

        }).catch((err)=>{
            console.log(err)
            callback({error: new Error("DB error")})
        })

    })
}

const useConfig = (userID, fileID, storageKey, callback) =>{
    mySession.then((session) => {

        const arcDB = session.getSchema("arcturus");
        const storageTable = arcDB.getTable("storage");

        storageTable.insert(["userID", "fileID", "storageKey", "statusID",]).values(
            userID, fileID, storageKey, status.Offline, 
        ).execute().then((storageInsert)=>{
            const affected = storageInsert.getAffectedItemsCount()

            if(affected > 0)
            {
                const storageID = storageInsert.getAutoIncrementValue();

                callback({success:true, storageID: storageID})
            }else{
                callback({success:false})
            }
        }).catch((err)=>{
            console.log(err)
            callback({error: new Error("DB error")})
        })

    })
}

const checkFileCRC = (crc, callback) =>{
    
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var fileTable = arcDB.getTable("file");
        
        fileTable.select(["fileID"]).where("fileCRC = :fileCRC").bind("fileCRC", crc).execute().then((selectRes)=>{
            const one = selectRes.fetchOne()
            if(one != undefined)
            {
                callback({fileID: one[0]})
            }else{
                callback({fileID: null})
            }
        }).catch((err) => {
            console.log(err)
            callback({ error: new Error("DB error") })
        })

    }).catch((err) => {
        console.log(err)
        callback({error:new Error("DB error")})
    })
}


const checkRealmName = (name, callback) => {
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var realmTable = arcDB.getTable("realm");


        realmTable.select(["realmName"]).where("realmName = :realmName").bind(
            "realmName", name
        ).execute().then((result)=>{
            if(result.fetchOne() == undefined)
            {
                callback(true)
            }else{
                callback(false)
            }
        }).catch((err)=>{
            console.log(err)
            callback(false)
        })
    })
}

const checkUserFile = (userID, fileID, callback) => {
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var userFileTable = arcDB.getTable("userFile");


        userFileTable.select(["userFilePermissions"]).where(
            "userID = :userID AND fileID = :fileID"
        ).bind(
            "userID", userID
        ).bind(
            "fileID", fileID
        ).execute().then((result) => {
            const one = result.fetchOne();
            if (one == undefined) {
                callback({userFilePermissions:null})
            } else {
                callback({userFilePermissions:one[0]})
            }
        }).catch((err) => {
            console.log(err)
            callback(false)
        })
    })
}

const addFileToRealm = (userID, realmID, fileInfo, callback) =>{
    mySession.then((session) => {

        const arcDB = session.getSchema('arcturus');
        const fileTable = arcDB.getTable("file")
        const realmFileTable = arcDB.getTable("realmFile")
        const realmTable = arcDB.getTable("realm");

        realmTable.select(["userID"]).where("userID = :userID").bind("userID", userID).execute().then((realmSelect)=>{
            const one = realmSelect.fetchOne()

            if(one != undefined)
            {
                checkFileCRC(fileInfo.crc, (result) => {
                    const fileID = result.fileID;
                    session.startTransaction()
                    if (fileID == null) {

                        fileTable.insert(
                            ["fileName", "fileCRC", "fileSize", "fileType", "fileMimeType", "fileLastModified"]
                        ).values(
                            [fileInfo.name, fileInfo.crc, fileInfo.size, fileInfo.type, fileInfo.mimeType, fileInfo.lastModified]
                        ).execute().then((fileInsert) => {

                            const fileID = fileInsert.getAutoIncrementValue()

                            realmFileTable.insert(["realmID", "fileID"]).values([realmID, fileID]).execute().then((realmFileInsert) => {
                                const affected = realmFileInsert.getAffectedItemsCount()
                                if (affected > 0) {
                                    const realmFileID = realmFileInsert.getAutoIncrementValue()
                                    session.commit()
                                    fileInfo.fileID = fileID;
                                    fileInfo.realmFileID = realmFileID;
                                    callback({success: true, file:fileInfo})
                                } else {
                                    session.rollback()
                                    callback({ success:false, msgCode:status.invalid })
                                }

                            }).catch((err) => {
                                console.log(err)
                                session.rollback();
                                callback({ error: new Error("userFile Insert failed.") })
                            })

                        }).catch((err) => {
                            console.log(err)
                            session.rollback();
                            callback({ error: new Error("File Insert failed.") })
                        })
                    } else {
                        checkRealmFile(realmID, fileID, (crfResult)=>{
                            if("error" in crfResult) {
                                session.rollback();
                                callback({error: crfResult.error})
                            }else{
                                if(crfResult.success)
                                {
                                    const realmFileID = crfr.realmFileID
                                    fileInfo.fileID = fileID;
                                    fileInfo.realmFileID = realmFileID;
                                    callback({ success: true, file: fileInfo })
                                }else{
                                    realmFileTable.insert(["realmID", "fileID"]).values([realmID, fileID]).execute().then((realmFileInsert) => {
                                        const affected = realmFileInsert.getAffectedItemsCount()
                                        if (affected > 0) {
                                            const realmFileID = realmFileInsert.getAutoIncrementValue()
                                            session.commit()
                                            fileInfo.fileID = fileID;
                                            fileInfo.realmFileID = realmFileID;
                                            callback({ success: true, file: fileInfo })
                                        } else {
                                            session.rollback()
                                            callback({ success: false, msgCode: status.invalid })
                                        }
                                    })
                                }
                            }
                        })
                    }
                })
            }else{
                callback({success:false, msgCode:status.invalid})
            }
        }).catch((err) => {
            console.log(err)
            session.rollback();
            callback({ error: new Error("DB error") })
        })
        
    }).catch((err) => {
        console.log(err)
        callback({ error: new Error("DB error") })
    })
}

const checkRealmFile = (realmID, fileID, callback) => {
    mySession.then((session) =>{
        const arcDB = session.getSchema("arcturus")
        const realmFileTable = arcDB.getTable("realmFile")

        realmFileTable.select(["realmFileID"]).where("fileID = :fileID and realmID = :realmID").bind("fileID", fileID).bind("realmID", realmID).execute().then((realmFileSelect) => {
            const rfsOne = realmFileSelect.fetchOne()
            if (rfsOne == undefined) {
                
                callback({success:false, realmFileID:null})
            }else{
                const realmFileID = rfsOne[0]
                callback({success:true, realmFileID: realmFileID})
            }
        }).catch((err)=>{
            console.log(err)
            callback({error:new Error("DB error")})
        })
    })
}

const insertFile = (fileTable, fileInfo) =>{
    return new Promise(resolve =>{
        fileTable.insert(
            ["fileName", "fileCRC", "fileSize", "fileType", "fileMimeType", "fileLastModified"]
        ).values(
            [fileInfo.name, fileInfo.crc, fileInfo.size, fileInfo.type, fileInfo.mimeType, fileInfo.lastModified]
        ).execute().then((fileInsert) => {

            const fileID = fileInsert.getAutoIncrementValue()
            fileInfo.fileID = fileID
            resolve(fileInfo)
        })
    })
    
}

const createRealm = (userID, realmName, imageFile, page, index, callback) => {
    mySession.then((session) => {

        const arcDB = session.getSchema('arcturus');
        const realmTable = arcDB.getTable("realm");
        const roomTable = arcDB.getTable("room");
        const fileTable = arcDB.getTable("file")
        const userRoomTable = arcDB.getTable("userRoom");
      
        const insertRealm = (innerRealmTable, realmName, userID,imageID, page, index, roomID, gatewayRoomID) =>{
            return new Promise(resolve =>{
            
                innerRealmTable.insert([
                    "realmName", 
                    "configID",
                    "userID", 
                    "roomID", 
                    "gatewayRoomID", 
                    "imageID",  
                    "realmPage", 
                    "realmIndex", 
                    "statusID", 
                    "accessID", 
                    "advisoryID", 
                    "realmType"
                 ]).values([
                    realmName, 
                    -1, 
                    userID, 
                    roomID, 
                    gatewayRoomID, 
                    imageID, 
                    page, 
                    index, 
                    status.Offline, 
                    access.private, 
                    advisory.none, 
                    ""
                ]).execute().then((realmResult) => {
                    const realmID = realmResult.getAutoIncrementValue()
                    resolve(realmID)
                })

            })
        }

      
           
     

        try{
             session.startTransaction()
           
                createRoom(roomTable,userRoomTable, userID, realmName).then((roomResult)=>{
                    if(!roomResult.success) throw new Error("room not created")

                    const roomID = roomResult.room.roomID
                    createRoom(roomTable,userRoomTable, userID, realmName).then((gatewayRoomResult) => {
                        if (!gatewayRoomResult.success) throw new Error("gateway room not created")

                        const gatewayRoomID = gatewayRoomResult.room.roomID
                        
                        if(roomID != undefined && gatewayRoomID != undefined){
                            let realm = {
                                    userID: userID,
                                    realmName: realmName,
                                    roomID: roomID,
                                    gatewayRoomID: gatewayRoomID,
                                    config: { fileID: -1, value: null, handle: null },
                                    realmPage: page,
                                    realmIndex: index,
                                    realmDescription: null,
                                    statusID: status.Offline,
                                    advisoryID: advisory.none,
                                    accessID: access.private,
                                    realmType: "",
                                }
                            checkFileCRC(imageFile.crc,(crcResult) =>{
                                if("error" in crcResult){
                                    session.rollback()
                                    callback({error:"Error in crc result"})
                                }else{
                                    if(crcResult.fileID == null)
                                    {
                                        insertFile(fileTable, imageFile).then((imageFileInfo)=>{
                                            const imageID = imageFileInfo.fileID;

                                            insertRealm(realmTable, realmName, userID, imageID, page, index, roomID, gatewayRoomID).then((realmID) => {
                                                
                                                realm.image = imageFileInfo;
                                                realm.realmID = realmID;
                                                session.commit()
                                                callback({success:true, realm:realm})
                                            })
                                        })
                                    
                                    
                                    }else{
                                        insertRealm(realmTable, realmName, userID, crcResult.fileID, page, index, roomID, gatewayRoomID).then((realmID) => {
                                            if (realmID != undefined) {
                                                imageFile.fileID = crcResult.fileID;
                                                realm.image = imageFile;
                                                realm.realmID = realmID;
                                                session.commit()
                                                callback({ success: true, realm: realm })
                                            }
                                        })
                                    }
                                }
                            
                            })

                        }else{
                            session.rollback()
                            callback({ error: new Error("Error adding room.") })
                        }
                })
            })    
             
        }catch(err){
            console.log(err)
            session.rollback()
            callback({ error: new Error ("Unable to create realm.") })
        }
        
          
    })
}

const getRealms = (userID, callback) =>{
    mySession.then((session) => {

        const query = "\
SELECT DISTINCT \
 realm.realmID, \
 realm.realmName, \
 realm.userID, \
 realm.roomID, \
 realm.statusID, \
 realm.realmPage, \
 realm.realmIndex, \
 image.fileID, \
 image.fileName, \
 image.fileCRC, \
 image.fileMimeType, \
 image.fileSize, \
 image.fileLastModified, \
 config.fileID, \
 config.fileName, \
 config.fileCRC, \
 config.fileMimeType, \
 config.fileSize, \
 config.fileLastModified, \
 realm.accessID, \
 realm.realmDescription, \
 realm.advisoryID, \
 realm.realmType, \
 realm.gatewayRoomID \
FROM \
 arcturus.realm, arcturus.status, arcturus.file as image, arcturus.file as config \
WHERE \
 realm.imageID = image.fileID AND realm.configID = config.fileID AND userID = " + userID 


 
       session.sql(query).execute().then((selectResult)=>{
            
            if(selectResult.hasData())
            {
                const all = selectResult.fetchAll()
                let realms = []
               
      
                all.forEach((value) => {
                    const realm = {
                        realmID: value[0],
                        realmName: value[1],
                        userID: value[2],
                        roomID: value[3],
                        statusID: value[4],
                        realmPage: value[5],
                        realmIndex: value[6],
                        image: {
                            fileID: value[7],
                            name: value[8],
                            crc: value[9],
                            mimeType: value[10],
                            size: value[11],
                            lastModified: value[12],
                            handle: null,
                            value: null
                        },
                        config: {
                            fileID: value[13],
                            name: value[14],
                            crc: value[15],
                            mimeType: value[16],
                            size: value[17],
                            lastModified: value[18],
                            value: null,
                            handle: null,
                        },
                        accessID: value[19],
                        realmDescription: value[20],
                        advisoryID: value[21],
                        realmType: value[22],
                        gatewayRoomID:value[23]
                       
                    };
                    console.log(realm)
                    realms.push(realm);     
                });
                
                
                
                callback({success:true, realms:realms})
            } else {
                callback({ success: false })
            }
        }).catch((err)=>{
            console.log(err)

            callback({error:new Error("DB error")})
        })
    })

}
const getUserSocket = (userID, callback) =>{
    mySession.then((session)=>{
        const arcDB = session.getSchema("arcturus")
        const userTable = arcDB.getTable("user")

        userTable.select(["userSocket"]).where("userID = :userID").bind("userID", userID).then((userSelect)=>{
            const one = userSelect.fetchOne()
            if(one != undefined)
            {
                const userSocket = one[0]
                if(userSocket == ""){ 
                    callback(null)
                }else{
                    callback(userSocket)
                }
            }else{
                callback(null)
            }
        }).catch((err)=>{
            callback(null)
        })
    })
}

const deleteRealm = (userID, realmID, callback) =>{
    
    mySession.then((session) => {
        //to get more complicated?

        var arcDB = session.getSchema("arcturus")
        const realmFile = arcDB.getTable("realmFile")
        var realmTable = arcDB.getTable("realm")
        const roomTable = arcDB.getTable("room")
        const userRoomTable = arcDB.getTable("userRoom")
        const realmUserTable = arcDB.getTable("realmUser")

        console.log("deleting realm: " + realmID + " by userID: " + userID)

        realmTable.select(["roomID", "gatewayRoomID"]).where("userID = :userID and realmID = :realmID").bind("userID", userID).bind("realmID", realmID).execute().then((realmSelect)=>{
            const rsOne = realmSelect.fetchOne()
            if(rsOne != undefined){
                const roomID = rsOne[0]
                const gatewayRoomID = rsOne[1]

                realmUserTable.select(["userID",]).where("realmID = :realmID").bind("realmID", realmID).execute().then((realmUserSelect)=>{
                    const rusrs = realmUserSelect.fetchAll()
                    session.startTransaction()
                    try {
                        let realmUsers = []
                        rusrs.forEach(realmUser => {
                            const realmUserID = realmUser[0];
                            realmUsers.push({userID:realmUserID})
                           
                        });
                        
                        realmFile.delete().where("realmID = :realmID").bind("realmID", realmID).execute();
                        realmUserTable.delete().where("realmID = :realmID").bind("realmID", realmID).execute()

                        realmTable.delete().where("userID = :userID AND realmID = :realmID").bind("userID", userID).bind("realmID", realmID).execute().then((deleted) => {
                            const affectedRealms = deleted.getAffectedItemsCount();
                            userRoomTable.delete().where("roomID = :roomID").bind("roomID", roomID).execute();
                            userRoomTable.delete().where("roomID = :roomID").bind("roomID", gatewayRoomID).execute();
                            roomTable.delete().where("roomID = :roomID").bind("roomID", roomID).execute();
                            roomTable.delete().where("roomID = :roomID").bind("roomID", gatewayRoomID).execute();

                            callback({success:affectedRealms > 0, realmUsers:realmUsers})
                        })
                        session.commit()
                    }catch(err){
                        console.log(err)
                        session.rollback()
                        callback({ error: new Error("realm delete DB error") })
                    }
                        

               
                })
              
            }
        })

      
    })

}


const updateRealmInformation = (information, callback) =>{
    const realmID = information.realmID
    const accessID = information.accessID
    const realmDescription = information.realmDescription
    const advisoryID = information.advisoryID
    const realmType = information.realmType

    console.log(information)

    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var realmTable = arcDB.getTable("realm");
    


        realmTable.update().set(
            "accessID", accessID
        ).set(
            "realmDescription", realmDescription
        ).set(
            "advisoryID", advisoryID
        ).set(
            "realmType",realmType
        ).where("realmID = :realmID").bind("realmID", realmID).execute().then((realmUpdateResult)=>{
            const affected = realmUpdateResult.getAffectedItemsCount()
            if(affected > 0)
            {
                callback({success:true})
            }else{
                callback({sucess:false})
            }
        }).catch((err)=>{
            console.log(err)
            callback({error: new Error("DB error")})
        })
    })
}



const enterRealmGateway = (user, realmID,socket, callback)=>{

    

    mySession.then((session) => {

        const arcDB = session.getSchema('arcturus');
        const realmTable = arcDB.getTable("realm");
        const userRoomTable = arcDB.getTable("userRoom");
        const userContactTable = arcDB.getTable("userContact")
        const fileTable = arcDB.getTable("file")
        const messageTable = arcDB.getTable("message")
        const userTable = arcDB.getTable("user")

        const finalize = (admin, userRoomTable, userTable, fileTable, userID, gatewayRoomID, roomID) => {
            return new Promise(resolve => {
                    getRoomUsers(userRoomTable, userTable, fileTable, gatewayRoomID).then((gatewayRoomResult) => {
                        if(!("success" in gatewayRoomResult)) throw new Error("getgatewayRoomUsers not successfull")
                        
                        const gatewayUsers = gatewayRoomResult.users

                        getRoomUsers(userRoomTable, userTable, fileTable, roomID).then((realmRoomResult) => {
                            if (!("success" in gatewayRoomResult)) throw new Error("getRoomUsers not successfull")

                            const realmUsers = realmRoomResult.users

                            const index = realmUsers.findIndex(search => search.userID == user.userID)

                            const realmMember = index > 0

                            getStoredMessages(messageTable, gatewayRoomID).then((messagesResult) => {
                            
                                setUserRoomStatus(userRoomTable, userID, gatewayRoomID, status.Online).then((statusUpdated) => {

                                    io.to(gatewayRoomID).emit("userRoomStatus", userID, status.Online);
                                    socket.join(gatewayRoomID)

                                    resolve({ admin: admin, realmMember:realmMember, success: true, gatewayUsers: gatewayUsers, realmUsers: realmUsers, gatewayMessages: messagesResult.messages });
                            })
                        })
                    })

                })
            
            })
        }
    
        realmTable.select(["userID", "accessID", "gatewayRoomID", "roomID"]).where("realmID = :realmID").bind("realmID", realmID).execute().then((realmSelect)=>{
            const oneRealm = realmSelect.fetchOne()

            if(oneRealm == undefined){
                callback({success:false})
            }else{
                const realmAdminID = oneRealm[0];
                const accessID = oneRealm[1];
                const gatewayRoomID = oneRealm[2]
                const roomID = oneRealm[3]

                const admin = realmAdminID == user.userID;
                userRoomTable.select(["userRoomBanned"]).where("userID =:userID and roomID = :roomID").bind("userID", user.userID).bind("roomID", gatewayRoomID).execute().then((userRoomSelect)=>{
                    const oneUserRoom = userRoomSelect.fetchOne()
                    if(!admin)
                    {
                        if (oneUserRoom == undefined) {
                            switch(accessID)
                            {
                                case access.private:
                                    callback({success:"false"})
                                    break;
                                case access.contacts:
                                    userContactTable.select(["userID"]).where("userID = :userID and contactID = :contactID").bind("userID", realmAdminID).bind("contactID", user.userID).execute().then((userContactSelect)=>{
                                        const ucsOne  = userContactSelect.fetchOne()
                                        if(ucsOne == undefined)
                                        {
                                            callback({ success: "false" })
                                        }else{
                                            addUserToRoom(userTable, userRoomTable, fileTable, user.userID, gatewayRoomID).then((added)=>{
                                                if(added){
                                        
                                                    finalize(admin, userRoomTable, userTable, fileTable, user.userID,gatewayRoomID,roomID).then(result  =>{
                                                        callback(result)
                                                    })
                                                  
                                                }else{
                                                    callback({ success: "false" })
                                                }
                                            })
                                        }
                                    })
                                    break;
                                case access.public:
                                    addUserToRoom(userTable, userRoomTable, fileTable, user.userID, gatewayRoomID).then((added) => {
                                        if (added) {

                                            finalize(admin, userRoomTable, userTable, fileTable, user.userID, gatewayRoomID, roomID).then(result => {
                                                callback(result)
                                            })

                                        } else {
                                            callback({ success: "false" })
                                        }
                                    })
                                    break;
                            }
                        }else{
                            const banned = oneUserRoom[0]
                            if(banned == 0){
                                finalize(admin, userRoomTable, userTable, fileTable, user.userID, gatewayRoomID, roomID).then(result => {
                                    callback(result)
                                })
                            }else[
                                callback({ success: "false" })
                            ]
                        }
                    
                    }else{
                        if(oneUserRoom == undefined)
                        {
                            addUserToRoom(userTable, userRoomTable, fileTable, user.userID, gatewayRoomID).then((added) => {
                                if(added){
                                    finalize(admin, userRoomTable, userTable, fileTable, user.userID, gatewayRoomID, roomID).then(result => {
                                        callback(result)
                                    })
                                }else{
                                    console.log("admin couldn't be added to gateway room")
                                    callback({ error: new Error("error joining room") })
                                }
                            })
                        }else{
                            finalize(admin, userRoomTable, userTable, fileTable, user.userID, gatewayRoomID, roomID).then(result => {
                                callback(result)
                            })
                        }

                    
                    }
                })
            }
        })
    })
    
}

const updateUserPeerID = (userID, peerID, callback) =>{

    mySession.then((session) => {

        const arcDB = session.getSchema('arcturus');
        const userTable = arcDB.getTable("user")
        const userRoom = arcDB.getTable("userRoom")

        userTable.update().set("userPeerID", peerID).where("userID = :userID").bind("userID", userID).execute().then((userUpdate)=>{
            const updated = userUpdate.getAffectedItemsCount() > 0
            
            if(updated){
                userRoom.select(["roomID"]).where("userID = :userID and statusID = :statusID").bind("userID", userID).bind("statusID", status.Online).execute().then((userRoomSelect) =>{
                   
                    const allRooms = userRoomSelect.fetchAll();
                    allRooms.forEach(room => {
                        const roomID = room[0]
                        io.to(roomID).emit("updateUserPeerID", peerID)
                    });
                   
                })
            }
            callback(updated)
        })
        
    })
}

        

// getCurrentScene(campaignID, isAdmin, userID, (scene) => { });