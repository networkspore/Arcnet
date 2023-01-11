import nodemailer  from "nodemailer"
import mysql from 'mysql2'
import mysqlx from '@mysql/xdevapi'
import util from 'util'
import aesjs from 'aes-js';
import { Server } from 'socket.io'
import moment from 'moment'
import bcrypt from 'bcrypt'
import { serverPassword, server, advisory, status, access, homeURL, socketURL, wwwURL, sqlCred, emailUser, emailPassword, authToken, loginToken } from './httpVars.mjs'
import { xmur3, sfc32, getRandomIntSync, getRandomIntSFC, generateCode, getUintHash, getStringHash, generateCodeBytes } from "./utils.mjs";
import { createMessage, encrypt, decrypt, generateKey, readMessage, readKey, decryptKey, readPrivateKey } from 'openpgp';
import { getFingerprint } from 'hw-fingerprint';

const serverKey = await getServerKey()

const fingerPrintHex = await getFingerPrintHex()

const instanceCode = await getInstanceCode(fingerPrintHex)

async function getFingerPrintHex() {
    const fp = getFingerprint()
    const fpHex = aesjs.utils.hex.fromBytes(fp.buffer)
    return fpHex
}

async function getInstanceCode(string) {
    const now = moment.now.toString(16)
    const seed = string + now

    const code = await generateCode(seed, 1024)
    const hash = getStringHash(code, 64)
    return hash
}

async function getServerKey() {

    const uint = aesjs.utils.utf8.toBytes(serverPassword)

    const uintHash = await getUintHash(uint, 32)

    return uintHash

}



const { privateKey, publicKey } = await generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: 'Arcnet', email: 'arcnet@arcturusnetwork.com' }],
    passphrase: instanceCode,
    format: 'armored'
});



const io = new Server(server, {
    cors: {
        origin: [homeURL, wwwURL, socketURL],
    },

});


server.listen(54944);


let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
        user: emailUser,
        pass: emailPassword
    },

});



var mySession = mysqlx.getSession(sqlCred);


const pingAlive = () => {
    if (!util.types.isPromise(mySession)) {
        mySession = mysqlx.getSession(sqlCred)
    }

    mySession.then((session) => {

        const arcDB = session.getSchema("arcturus");
        const keepAliveTable = arcDB.getTable("keepAlive");

        keepAliveTable.select(["keepAliveValue"]).where("keepAliveID = 1").execute().then((res) => {
            const keepAliveValue = res.fetchOne();
            if (keepAliveValue != undefined) {
                console.log(keepAliveValue[0]);
            } else {
                console.log(0)
            }
        }).catch((err) => {
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


io.on('connection', (socket) => {
    const id = socket.id;
    let checkingUser = false
    let token = null
    let clientKey = null
    io.to(id).emit("serverInit", publicKey)
  
    
    if (socket.handshake.auth.token == authToken) {
        socket.on("getAnonContext", (encryptedContext, anonContextCallback)=>{

            decryptStringfromClient(encryptedContext).then((decryptedString) =>{
                const decryptedContext = JSON.parse(decryptedString)
                const { contextKey, contextID } = decryptedContext
                clientKey = contextKey

                checkContextID(contextID).then((contextValid) =>{
                    
                    if(!contextValid){
                        anonContextCallback(false)
                    }else{
                        anonContextCallback(true)

                        socket.on('createUser', (params, callback) => {
                     
                            if (!checkingUser && token != null && token == "checked") {
                                checkingUser = true
                              
                                createUser(params).then((result) => {

                                   
                                    callback(result)
                                    
                                });
                            } else {
                                socket.disconnect()
                            }
                        });


                        socket.on('checkUserName', (userName, check) => {
                            
                            checkUserName(userName).then((results) => {
                               
                                check(results);
                                
                            });
                            
                        });


                        socket.on('checkRefCodeEmail', (encryptedString, returnValid) => {
                            if (!checkingUser) {
                                checkingUser = true
                                decryptStringfromClient(encryptedString).then((decryptedString)=>{
                                    const params = JSON.parse(decryptedString)
                                    checkRefCodeEmail(params).then((results) => {
                                   
                                        console.log(results)
                                        setTimeout(() => {
                                            checkingUser = false
                                            token = "checked"
                                            console.log(token)
                                            const jsonString = JSON.stringify(results)
                                            encryptString(jsonString, clientKey).then((encryptedString)=>{
                                                returnValid(encryptedString);
                                            })
                                        
                                        }, 200);
                                    })
                                })
                            } else {
                                token = null
                                const jsonString = JSON.stringify({error: "Unable to process request"})
                                encryptString(jsonString, clientKey).then((encryptedString) => {
                                    returnValid(encryptedString);
                                })
                            }
                        });

                        socket.on("sendRecoveryEmail", (email, callback) => {
                            if (!checkingUser) {
                                checkingUser = true
                                sendRecoveryEmail(email, (sent) => {
                                    setTimeout(() => {
                                        checkingUser = false
                                        if ("success" in sent && sent.success) token = "recovery"
                                        callback(sent)
                                    }, 500);
                                })
                            } else {
                                socket.disconnect()
                            }
                        })
                        socket.on("updateUserPassword", (info, callback) => {
                            if (!checkingUser && token == "recovery") {
                                checkingUser = true
                                setTimeout(() => {
                                    updateUserPasswordAnon(info, (result) => {
                                        callback(result)
                                        socket.disconnect()
                                    })
                                }, 500);
                            } else {
                                socket.disconnect()
                            }
                        })
                    }
                })
            })

            
        })


        
    } else if (socket.handshake.auth.token == loginToken) {
        socket.on("login", (encryptedString, callback) => {
            
            if (checkingUser) connectedSocket.disconnect()
            checkingUser = true
            
            decryptStringfromClient(encryptedString).then((decryptedString) => {

                const clientContext = JSON.parse(decryptedString)
                const {contextID, contextKey, nameEmail, password} = clientContext
      
                clientKey = contextKey

                checkUser({nameEmail: nameEmail, password: password}, clientKey).then((checkResult) => {
            
                    if ("success" in checkResult && checkResult.success) {
                    

                


                        const user = checkResult.user;
                        const userCode = checkResult.userCode

                        const userSocket = checkResult.userSocket

                        if (userSocket != "") {
                            io.sockets.sockets.forEach((connectedSocket) => {
                                console.log(connectedSocket.id)
                                if (connectedSocket.id == userSocket) {
                                    console.log("disconnecting old socket: " + userSocket)
                                    connectedSocket.disconnect()
                                
                                }
                            });
                        }
                        getContacts(user, (contacts) => {

                            getUserFiles(user.userID).then((userFiles) => {

                                updateUserStatus(user.userID, status.Online, id, (isRooms, rooms) => {
                                    if (user.accessID != access.private && isRooms) {
                                        for (let i = 0; i < rooms.length; i++) {

                                            console.log("sending userStatus message to: " + rooms[i][0] + " user: " + user.userID + " is: Online");

                                            io.to(rooms[i][0]).emit("contactsCmd", { cmd: "userStatus", params: { userID: user.userID, statusID: status.Online, userSocket: user.userSocket, accessID: user.accessID } });

                                        }
                                    }
                                    if (user.accessID != access.private && contacts.length > 0) {
                                        contacts.forEach(contact => {
                                            if (contact.statusID == status.Online && contact.userSocket != "") {
                                                io.to(contact.userSocket).emit("contactsCmd", { cmd: "userStatus", params: { userID: user.userID, statusID: status.Online, userSocket: user.userSocket, accessID: user.accessID } });
                                            }
                                        });
                                    }
                                    const jsonString = JSON.parse({ success: true, user: user, contacts: contacts, userFiles: userFiles, userCode: userCode })

                                    encryptString(jsonString, clientKey).then((encryptedString)=>{
                                        checkingUser = false;
                                        callback(encryptedString)
                                    })
                                    
                                    
                                })
                            })

                        })



                        /* //////////////SUCCESS///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/
                        socket.on("getAppList", (params, callback)=>{
                            console.log("getAppList")
                            if("admin" in params && params.admin)
                            {
                                if(user.userID == 22){ 
                                    getAppList(params).then((result) => {
                                        result.admin = true
                                        console.log(result)
                                        callback(result)
                                    })
                                }else{
                                console.log("not admin")
                                    callback({error: new Error("Not admin")})
                                }
                            }else[
                                getAppList(params).then((result) => {
                                    callback(result)
                                })
                            ]
            
                            
                        })
                        
                        socket.on("updateUserAccess", (info, callback) => {

                            updateUserAccess(user.userID, info).then((result) => {
                                callback(result)
                            })
                        })

                        socket.on("updateUserPassword", (info, callback) => {


                            updateUserPassword(user.userID, info, (result) => {
                                callback(result)
                            })
                        })
                        socket.on("sendEmailCode", (callback) => {

                            sendEmailCode(user.userID, (sent) => {
                                callback(sent)
                            })
                        })
                        socket.on("getFilePeers", (fileID, callback) => {
                            getFilePeers(user.userID, fileID, (result) => {
                                callback(result)
                            })
                        })


                        socket.on("enterRealmGateway", (realmID, callback) => {

                            enterRealmGateway(user, realmID, socket, (enteredGateway) => {
                                callback(enteredGateway)
                            })
                        })

                        socket.on("checkRealmName", (name, callback) => {
                            checkRealmName(name, callback)
                        })

                        socket.on("createRealm", (realmName, imageFile, page, index, callback) => {
                            createRealm(user.userID, realmName, imageFile, page, index, (created) => {
                                callback(created)
                            })
                        })

                        socket.on("deleteRealm", (realmID, callback) => {
                            deleteRealm(user.userID, realmID, (result) => {
                                if (!("error" in result)) {
                                    if (result.success) {
                                        result.realmUsers.forEach(user => {
                                            getUserSocket(user.userID, (userSocket) => {
                                                if (userSocket != null) io.to(userSocket).emit("realmDelete", realmID)
                                            })
                                        });
                                    }
                                }
                                callback(result)
                            })
                        })

                        socket.on("getRealms", (callback) => {
                            getRealms(user.userID, (realms) => {
                                callback(realms)
                            })
                        })

                        socket.on("updateRealmInformation", (information, callback) => {
                            updateRealmInformation(information, (result) => {
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
                            createRefCode(user, code, (result) => {
                                callback(result)
                            })
                        })

                        socket.on("getUserReferalCodes", (callback) => {
                            getUserReferalCodes(user, (result) => {
                                callback(result)
                            })
                        })

                        socket.on("checkStorageHash", (params, callback) => {
                        checkStorageHash(user.userID, params).then((result)=>{
                                callback(result)
                            })
                        })
                        socket.on("createStorage", (params, callback) => {
                            createStorage(user.userID, params).then((result) => {
                                callback(result)
                            })
                        })
                        socket.on("getStorageKey", (callback) => {
                            getStorageKey(user.userID).then((result) => {
                                callback(result)
                            })
                        })
                        socket.on("checkPassword", (params, callback)=>{
                            checkPassword(user.userID, params).then((result)=>{
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
                        })*/  /*
                        socket.on("createStorage", (fileInfo, engineKey, callback) => {

                            createStorage(user.userID, fileInfo, engineKey, (created) => {
                                callback(created)
                            })
                        })

                        socket.on("useConfig", (fileID, callback) => {
                            useConfig(user.userID, fileID, (success) => {
                                callback(success)
                            })
                        })
                    
                        socket.on("checkStorageHash", (hash, callback) => {
                            checkStorageHash(user.userID, hash, (result) => {
                                callback(result)
                            })
                        })

                        socket.on("loadStorage", (hash, engineKey, callback) => {

                            loadStorage(hash, engineKey, (storage) => {
                                callback(storage)
                            })

                        })

                        socket.on("updateStorageConfig", (fileID, fileInfo, callback) => {
                            updateStorageConfig(fileID, fileInfo, (result) => {
                                callback(result)
                            })
                        })*/
                        /*
                        socket.on("checkUserFiles", (hashs, callback) => {
                            checkUserFiles(user.userID, hashs, (result) => {
                                callback(result)
                            })
                        })*/


                        socket.on("updateSocketID", (userID) => {
                            updateSocketID(userID, id);
                        })


                        socket.on('searchPeople', (text, returnPeople) => {

                            findPeople(text, user.userID, (results) => {
                                returnPeople(results)
                            });
                        });

                        socket.on("updateUserPeerID", (peerID, callback) => {
                            console.log("updatingPeerID: " + peerID)
                            updateUserPeerID(user.userID, peerID, (result) => {
                                callback(result)
                            })
                        })

                        socket.on("updateUserImage", (imageInfo, callback) => {
                            updateUserImage(user.userID, imageInfo, (updated) => {
                                callback(updated)
                            })
                        })

                        socket.on("updateRealmImage", (realmID, imageInfo, callback) => {
                            updateRealmImage(user.userID, realmID, imageInfo, (result) => {
                                callback(result)
                            })
                        })

                        socket.on("peerFileRequest", (params, callback) => {
                            console.log("peer file request")
                            console.log(params)
                            peerFileRequest(user.userID, params).then((response) => {
                                callback(response)
                            })
                        })

                        socket.on("updateUserEmail", (params, callback) => {
                            updateUserEmail(user.userID, params).then((result) => {
                                callback(result)
                            })
                        })


                        socket.on("getPeerLibrary", (params, callback) => {
                            getPeerLibrary(user.userID, params).then((result) => {
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


                    }else{
                        const jsonString = JSON.stringify(checkResult)

                        encryptString(jsonString, clientKey).then((encryptedString) => {
                            checkingUser = false;
                        //   setTimeout(() => {
                                callback(encryptedString)
                        // }, 500);
                            
                        })

                    }
                });
            })
        })


    } else {
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

            userRoomTable.insert(["userID", "roomID", "statusID"]).values(userID, roomID, status.Offline).execute().then((userRoomInsert) => {
                resolve(
                    {
                        success: true,
                        room: {
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



const addUserToRoom = (userRoomTable, userID, roomID) => {
    return new Promise(resolve => {
        userRoomTable.insert(["userID", "roomID", "statusID"]).values(userID, roomID, status.Offline).execute().then((userAddedToRoom) => {
            const affected = userAddedToRoom.getAffectedItemsCount() > 0;
            if (affected) {

                io.to(roomID).emit("addedUserIDtoRoom", userID);

            }
            resolve(affected)
        })
    })
}

const updateUserStatus = (userID = -1, statusID = 5, socketID = "", callback) => {
  

    mySession.then((session) => {

        const query = `UPDATE arcturus.user SET userSocket = ${mysql.escape(socketID)}, statusID = ${statusID}, userLastOnline = NOW() WHERE userID = ${userID}`
    
        session.sql(query).execute().then((updated) => {
            const affected = updated.getAffectedItemsCount();
            console.log("updated status affected: " + affected)
            if (affected > 0) {
                const query2 = "select userRoom.roomID, status.statusName from arcturus.userRoom, arcturus.status WHERE userRoom.userID = userID AND status.statusID = userRoom.statusID";
                session.sql(query2).execute().then((found) => {
                    const inRooms = found.hasData()
                    const rooms = inRooms ? found.fetchAll() : [];

               /*     const contactQuery = "\
SELECT distinct userID, userSocket \
FROM arcturus.user, arcturus.status, arcturus.contact \
WHERE \
statusName = 'Online' AND \
status.statusID = user.statusID AND \
contact.userID = user.userID AND \
contact.contactID = " + userID;*/

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

    if (userID > 0) {
        mySession.then((session) => {
            const arcDB = session.getSchema("arcturus")
            const userRoomTable = arcDB.getTable("userRoom")
   
            updateUserPeerID(userID, "", (callback) => {
                console.log(callback)
            })

            const query = `UPDATE arcturus.user SET userSocket = '', statusID = ${status.Offline}, userLastOnline = NOW() WHERE userID = ${userID}`

            session.sql(query).execute().then((updatedUserSocket) => {
                userRoomTable.select(["roomID"]).where("userID = :userID and statusID <> " + status.Offline).bind("userID", userID).execute().then((userRoomSelect) => {

                    const allRooms = userRoomSelect.fetchAll();
                    if (allRooms != undefined) {
                        userRoomTable.update().set("statusID", status.Offline).where("userID = :userID").bind("userID", userID).execute().then((userRooms) => {
                            const roomsAffected = userRooms.getAffectedItemsCount();
                            if (roomsAffected > 0) {

                                allRooms.forEach(room => {
                                    const roomID = room[0];
                                    console.log("sending userStatus message to: " + roomID + " user: " + userID + " is: Offline");
                                    io.to(roomID).emit("userStatus", userID, status.Offline);
                                });
                                callback(roomsAffected);


                            } else {
                                callback(roomsAffected);
                            }
                        })
                    } else {
                        callback(0)
                    }
                })
            })

        })
    } else {
        callback(0)
    }

}




const setUserRoomStatus = (userRoomTable, userID, roomID, statusID = 4) => {

    return new Promise(resolve => {


        userRoomTable.update().set("statusID", statusID).where("userID = :userID AND roomID = :roomID").bind("userID", userID).bind("roomID", roomID).execute().then((results) => {
            affectedRows = results.getAffectedItemsCount();

            if (affectedRows > 0) {
                resolve({ success: true });
            } else {
                resolve({ success: false });
            }
        })

    })
}

const getRoomUsers = (session, userRoomTable, userTable, contactIDList, roomID) => {
    return new Promise(resolve => {

        userRoomTable.select(["userID", "statusID"]).where("roomID = :roomID").bind("roomID", roomID).execute().then((userRoomSelect) => {

            const all = userRoomSelect.fetchAll()

            if (all != undefined) {

                let roomUsers = []
                let i = 0;
                const recursiveInformation = () => {

                    if (i < all.length) {

                        const roomUser = all[i]
                        const userID = roomUser[0]
                        const statusID = roomUser[1]

                        const isContact = Array.isArray(contactIDList) ? contactIDList.findIndex(list => list == userID) != -1 : false

                        getContactInformation(userTable, session, userID, isContact).then((userInformation) => {
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

            } else {
                resolve({ success: false, users: [] })
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

    return new Promise(resolve => {
        messageTable.select(["messageID", "userID", "messageType", "messageText", "messageTime"]).where("roomID = :roomID").orderBy(["messageTime DESC"]).limit(30).bind("roomID", roomID).execute().then((result) => {


            const all = result.fetchAll()

            if (all != undefined) {
                let messages = []
                for (let i = all.length - 1; i > -1; i--) {
                    messages.push({
                        messageID: all[i][0],
                        userID: all[i][1],
                        messageType: all[i][2],
                        messageText: all[i][3],
                        messageTime: all[i][4],
                    })
                }

                resolve({ success: true, messages: messages });
            } else {
                callback({ success: false, messages: [] });
            }

        })

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
        const fileTable = arcDB.getTable("file");
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

                                    io.to(contact.userSocket).emit("acknowledgeContact", { acknowledgement: acknowledgement, contact: user })

                                })

                                callback({
                                    acknowledgement: acknowledgement,
                                    success: true,
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
    /* const name_email = mysql.escape(text);
     var query = "SELECT userName, userEmail, user.userID FROM arcturus.user WHERE (userName LIKE ";
     query += name_email + " OR userEmail LIKE " + name_email + ") AND user.userID <> " + userID + " AND user.userID NOT IN (\
  SELECT contactID from arcturus.userContact where userID = " + userID + " ) LIMIT 50";*/


    mySession.then((session) => {
        const arcDB = session.getSchema("arcturus")
        const userContactTable = arcDB.getTable("userContact")
        const userTable = arcDB.getTable("user")

        userContactTable.select(["contactID"]).where("userID = :userID").bind("userID", userID).execute().then((contactResults) => {
            const contactsArray = contactResults.fetchAll()
            let contactList = ""

            if (contactsArray != undefined && contactsArray.length != 0) {
                const contactsLength = contactsArray.length
                for (let i = 0; i < contactsLength - 1; i++) {
                    const contactID = contactsArray[i][0]
                    contactList.concat(`'${contactID}',`)
                }
                const contactID = contactsArray[contactsLength - 1][0]
                contactList.concat(`'${contactID}'`)
            }
            if (contactList == "") contactList = "''"

            userTable.select(["userID"]).where("LOWER(userName) LIKE :text AND userID <> :userID AND userID NOT IN (:contactList) and accessID > 0")
                .bind("text", text)
                .bind("userID", userID)
                .bind("contactList", contactList)
                .execute().then((selectResults) => {

                    const people = selectResults.fetchAll()


                    if (people == undefined) {
                        callback([]);
                    } else {

                        const resultLength = people.length;

                        let searchResults = [];
                        let i = 0;


                        const getContactInfoRecursive = () => {
                            const contactID = people[i][0]

                            getContactInformation(userTable, session, contactID, false).then((contactInfoResult) => {
                                if ("success" in contactInfoResult && contactInfoResult.success) {

                                    const contact = contactInfoResult.user

                                    searchResults.push(contact)

                                }
                                i++
                                if (i < resultLength) {
                                    getContactInfoRecursive()
                                } else {
                                    callback(searchResults)
                                }
                            }).catch((err) => {
                                console.log(err)
                                i++
                                if (i < resultLength) {
                                    getContactInfoRecursive()
                                } else {
                                    console.log(searchResults)
                                    callback(searchResults)
                                }
                            })
                        }

                        /*for (let i = 0; i < people.length; i++) {
                        const person = {
                            userID:     people[i][0],
                            userName:   people[i][1],
                            
                        }
                       
                        searchResults.push(
                            person
                        )
                    }*/
                        if (people.length == 0) {
                            callback([])
                        } else {
                            getContactInfoRecursive()
                        }
                    }
                })
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


const checkUserName = (name = "") => {

    return new Promise(resolve =>{
        mySession.then((session) => {
            const arcDB = session.getSchema("arcturus")
            const userTable = arcDB.getTable("user")

            userTable.select(["userName"]).where("userName = :userName").bind("userName", name).execute().then((result) => {
                
                const one = result.fetchOne()

                if (one == undefined) {
                    resolve(true)
                } else{
                    resolve(false)
                } 
            })
        }).catch((reason) => {
            console.log(reason);
            resolve({error: new Error("db error")});
        })
    })
}

function generateUserCode()
{
    return new Promise(resolve =>{

        generateCodeBytes(fingerPrintHex, 128).then((userCodeBytes)=>{
           
            
            encryptBytesToHex(userCodeBytes).then((userCodeHex)=>{
                resolve(userCodeHex)
            })
        })
        
    })
}

function encryptBytesToHex(bytes){
    return new Promise(resolve =>{ 

        const aesCtr = new aesjs.ModeOfOperation.ctr(serverKey);
        const encryptedBytes = aesCtr.encrypt(bytes);

        const hexCode = aesjs.utils.hex.fromBytes(encryptedBytes)

        resolve(hexCode)
    })
}

function encryptHex(string){
    return new Promise(resolve =>{

        const input = aesjs.utils.hex.toBytes(string)
        const aesCtr = new aesjs.ModeOfOperation.ctr(serverKey);

        const encryptedString = aesCtr.encrypt(input);
        const hexString = aesjs.utils.hex.fromBytes(encryptedString)

        resolve(hexString)
    })
}
async function decryptStringfromClient(encryptedString){
    
    const decryptedKey = await decryptKey({
        privateKey: await readPrivateKey({ armoredKey: privateKey }),
        passphrase: instanceCode
    });

    const decryptedMessage = await readMessage({
        armoredMessage: encryptedString 
    });
  

    const decrypted = await decrypt({
        message:decryptedMessage,
        decryptionKeys: decryptedKey

    });

    const chunks = [];
    for await (const chunk of decrypted.data) {
        chunks.push(chunk);
    }
    
    const decryptedString = chunks.join('');
  
    return decryptedString
  
}




function createUser(encryptedUser) {
   // var date = new Date().toString();
    return new Promise(resolve =>{
        console.log("creating user")
        mySession.then((session) => {
            try {

                decryptStringfromClient(encryptedUser).then((decryptedJSON)=>{

                    const user = JSON.parse(decryptedJSON)
                    session.startTransaction();

                    var arcDB = session.getSchema('arcturus');
                    var userTable = arcDB.getTable("user");
                    const refTable = arcDB.getTable("ref")
                
              
                    const refCode = user.refCode
                    console.log(refCode)

                    refTable.select(["refID"]).where("refCode = :refCode").bind("refCode", refCode).execute().then((refSelect)=>{
                        const oneRef = refSelect.fetchOne()
                        if(oneRef != undefined){
                            const refID = oneRef[0]
                            console.log(user.userName,
                                "email:", user.userEmail,
                                "refCode:", refCode,
                                "refID:", refID,
                                "status:", status.Offline,
                                "access:", access.contacts)
                            generateUserCode(user.userPassword + user.userEmail).then((userCode) =>{ 
                                
                            bcrypt.hash(user.userPassword + "", 15).then((bcryptedPass) =>{
                        
                            
                                
                                userTable.insert([
                                        'userName', 
                                        'userPassword', 
                                        "userEmail", 
                                        'refID', 
                                        'statusID', 
                                        "accessID",  
                                        "userCode"
                                    ]).values([
                                        user.userName, 
                                        bcryptedPass, 
                                        user.userEmail, 
                                        refID, 
                                        status.Offline, 
                                        access.contacts, 
                                        userCode
                                    ]).execute().then((insertedResult) => {

                                        const userID = insertedResult.getAutoIncrementValue()

                                        if(userID > 0){
                                          
                                          
                                                resolve({ success: true })
                                            
                                        }else{

                                            session.rollback();
                                            resolve({success:false})
                                        }
                                
                                })

                                session.commit();
                            })
                        })
                    }else{
                            session.rollback();
                            resolve({ success: false })
                    }
                    })
                    

                })
            } catch (error) {
                console.log(error)
                session.rollback();
                resolve({error: new Error("Rolled back") });
            }
        })

    })
   
}

const createUserContext = (userID, contextID) =>{
    return new Promise(resolve =>{
        mySession.then((session) => {
            try {

                decryptStringfromClient(encryptedUser).then((decryptedJSON) => {

                    const user = JSON.parse(decryptedJSON)
                    session.startTransaction();

                    var arcDB = session.getSchema('arcturus');
                    var userTable = arcDB.getTable("user");

                    const userContextTable = arcDB.getTable("userContext")
                    console.log("inserted:", userID, user.userName, user.userEmail)

                    userContextTable.insert(['contextID', 'userID']).values([contextID, userID]).execute().then((inserted) => {

                    })
                })
            } catch (err) {

            }

        })
    })
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

            callback({ success: true, code: { refCode: code, refCreated: now } })
        } catch (error) {
            console.log(error)
            session.rollback();
            callback({ success: false });
        }

    }).catch((error) => {
        console.log(error)
        callback({ success: false })
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

    console.log("sending Email")
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

const getContacts = (user, callback) => {


    console.log("getting contacts")

    mySession.then((session) => {
        const arcDB = session.getSchema("arcturus")
        const userTable = arcDB.getTable("user")
        const userContactTable = arcDB.getTable("userContact")


        userContactTable.select(["contactID", "statusID", "userContactMsg", "userID"]).where("userID = :userID OR (contactID =:userID and statusID = 3)").bind("userID", user.userID).execute().then((results) => {
            const contactsArray = results.fetchAll();


            if (contactsArray != undefined) {

                console.log(contactsArray)
                var contacts = [];
                var i = 0;


                const getContactInfoRecursive = () => {
                    console.log(i)
                    const contact = contactsArray[i]

                    const contactID = contact[0]
                    const statusID = contact[1]
                    const userContactMsg = contact[2]
                    const userContactUserID = contact[3]

                    const isContact = user.userID == userContactUserID && statusID == status.accepted



                    getContactInformation(userTable, session, contactID, isContact).then((contactInfo) => {


                        contactInfo.accepted = isContact
                        contactInfo.requested = contactID == user.userID
                        contactInfo.userContactMsg = userContactMsg

                        if ("success" in contactInfo && contactInfo.success) {


                            contacts.push(
                                contactInfo
                            )
                            i = i + 1;
                            if (i < contactsArray.length) {

                                getContactInfoRecursive()
                            } else {

                                callback(contacts)
                            }

                        }

                    })
                }

                if (contactsArray.length > 0) {
                    console.log("calling recursive function")
                    getContactInfoRecursive()
                } else {
                    callback([])
                }
            } else {
                console.log("No contacts found")
                callback([])
            }
        })
    }).catch((error) => {
        console.log(error);
    })
}

const getContactInformation = (userTable, session, userID, isContact) => {
    console.log('getting Contact information')

    return new Promise(resolve => {
        userTable.select(["userID", "userName", "userHandle", "userSocket", "statusID", "userFileID", "accessID"]).where("userID = :userID").bind("userID", userID).execute().then((userSelect) => {
            const one = userSelect.fetchOne()

            if (one != undefined) {
                console.log(one)
                const accessID = one[6]

                const contactID = one[0];
                const userName = one[1];
                const userHandle = accessID != access.private ? one[2] : null;
                const userSocket = one[3];
                const statusID = accessID != access.private ? one[4] : status.Offline;
                const userFileID = accessID != access.private ? one[5] : null;


                let user = {
                    userID: contactID,
                    userName: userName,
                    userHandle: userHandle,
                    userSocket: userSocket,
                    statusID: statusID,
                    accessID: accessID,
                    isContact: isContact,
                    image: {
                        fileID: -1,
                        name: null,
                        hash: null,
                        mimeType: null,
                        type: null,
                        size: null,
                        lastModified: null,
                    }
                }

                if (userFileID != null) {

                    getFileUserFileID(userFileID, contactID, isContact, session).then((file) => {
                        user.image = file
                        console.log(file)
                        resolve({ success: true, user: user })
                    })
                } else {
                    resolve({ success: true, user: user })
                }


            } else {
                throw new Error("not a user")
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

const getOwnUserFile = (userFileID, session) => {
    return new Promise(resolve => {
        const userFileQuery = "SELECT DISTINCT file.fileID, file.fileName, file.fileHash, file.fileMimeType, file.fileType, file.fileSize, file.fileLastModified \
FROM arcturus.userFile, arcturus.file WHERE userFile.userFileID = " + userFileID + " AND file.fileID = userFile.fileID"

        session.sql(userFileQuery).execute().then((userFileSelect) => {

            if (userFileSelect.hasData()) {
                const value = userFileSelect.fetchOne()
                file = {
                    fileID: value[0],
                    name: value[1],
                    hash: value[2],
                    mimeType: value[3],
                    type: value[4],
                    size: value[5],
                    lastModified: value[6],
                }
                resolve(file)
            } else {
                resolve(null)
            }
        })
    })
}
const getFileUserFileID = (userFileID, userID, isContact, session) => {
    console.log("getting user file")
    return new Promise(resolve => {

        let userFileQuery = `
SELECT DISTINCT 
 file.fileID, 
 file.fileName, 
 file.fileHash, 
 file.fileMimeType, 
 file.fileType, 
 file.fileSize, 
 file.fileLastModified,
 userFile.userFileTitle,
 userFile.userFileText
FROM 
 arcturus.userFile, 
 arcturus.file, 
 arcturus.user
WHERE 
 (
    userFile.accessID = ${access.public} AND userFile.userFileID = ${userFileID} AND file.fileID = userFile.fileID
 )
 OR 
  ( userFile.userFileID = ${userFileID} AND file.fileID = userFile.fileID AND userFile.userFileUserAccess LIKE "%'${userID}'%")`

        if (isContact) {
            userFileQuery = userFileQuery.concat(` OR
 (
     userFile.accessID = ${access.contacts} AND userFile.userFileID = ${userFileID} AND file.fileID = userFile.fileID
 )`)
        }
        session.sql(userFileQuery).execute().then((userFileSelect) => {

            if (userFileSelect.hasData()) {
                const value = userFileSelect.fetchOne()

                // const accessID = value[7];
                // const userAccess = value[8];


                file = {
                    fileID: value[0],
                    name: value[1],
                    hash: value[2],
                    mimeType: value[3],
                    type: value[4],
                    size: value[5],
                    lastModified: value[6],
                    userFileID: userFileID,
                    title: value[7],
                    text: value[8],

                }

                resolve(file)
                /*switch (accessID) {
                    case 1:
                        if (isContact) {
                            resolve(file)
                        } else {
                            resolve(nullFile)
                        }
                        break;
                    case 2:
                        
                        break;
                    default:
                        resolve(nullFile)
                }*/



            } else {
                resolve(nullFile)
            }
        })
    })
}

function decryptHexUint(encryptedHex){
    return new Promise(resolve =>{
   
        const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);

        const aesCtr = new aesjs.ModeOfOperation.ctr(serverKey);
        
        const decryptedBytes = aesCtr.decrypt(encryptedBytes);

        resolve(decryptedBytes)
    
    })
}
/*
function decryptHexString(encryptedHex){
    return new Promise(resolve => {

        const encryptedBytes = aesjs.utils.hex.toBytes(encryptedHex);

        const aesCtr = new aesjs.ModeOfOperation.ctr(serverKey);

        const decryptedBytes = aesCtr.decrypt(encryptedBytes);

        const hexString = aesjs.utils.hex.fromBytes(decryptedBytes)

        resolve(hexString)

    })
}*/
async function encryptString(string, publicKeyArmored) {

    const publicKey = await readKey({ armoredKey: publicKeyArmored });

    const encrypted = await encrypt({
        message: await createMessage({ text: string }), 
        encryptionKeys: publicKey,
    });

    return encrypted
}



const checkUser = (user) => {
    return new Promise(resolve =>{


        try{  
           
                
            
                mySession.then((session) => {

                    const arctDB = session.getSchema("arcturus")
                    const userTable = arctDB.getTable("user")


                    userTable.select(["userID", "userName", "userEmail", "userHandle", "userFileID", "userSocket", "accessID", "userCode", "userPassword"]).where(
                        "( LOWER(userName) = LOWER(:nameEmail) OR LOWER(userEmail) = LOWER(:nameEmail)) AND (userPasswordCheckCount < 30 OR HOUR(TIMEDIFF(NOW(), userPasswordLastChecked))>24)"
                    ).bind("nameEmail", user.nameEmail + "").execute().then((results) => {
                        const userArr = results.fetchOne()

                        if (userArr == undefined) {
                            setTimeout(() => {
                                resolve({ success: false })
                            }, 500);
                                
                         
  
                        } else {
                            const passwordHash = userArr[8]
                            
                          /*  setInterval(() => {
                                
                            }, 10);*/
                            bcrypt.compare(user.password, passwordHash, function (err, result) {
                                
                                if(!result){
                                    userTable.select(["userPasswordCheckCount", "userID"]).where(
                                        "( LOWER(userName) = LOWER(:nameEmail) OR LOWER(userEmail) = LOWER(:nameEmail))").bind("nameEmail", user.nameEmail + "").execute()
                                        .then((results) => {
                                            const one = results.fetchOne()

                                            if (one != undefined) {
                                                console.log("updated")
                                                const count = one[0]
                                                const userID = one[1]
                                                session.sql(`UPDATE arcturus.user SET userPasswordCheckCount = ${count + 1}, userPasswordLastChecked = NOW() WHERE userID = ${userID}`).execute().then((updated) => {
                                                    resolve({ success: false })
                                                })

                                            } else {
                                                console.log("didn't update")
                                                resolve({ success: false })

                                            }
                                        })
                                
                                }else{
                                    const encryptedCodeHex = userArr[7]

                                
                                    decryptHexUint(encryptedCodeHex).then((codeUint) => {
                                    
                                        const codeHex = aesjs.utils.hex.fromBytes(codeUint)
                                        const userID = userArr[0];
                                        const userFileID = userArr[4];
                                        const userSocket = userArr[5];

                                        let loginUser = {
                                            userID: userID,
                                            userName: userArr[1],
                                            userEmail: userArr[2],
                                            userHandle: userArr[3],
                                            accessID: userArr[6],
                                            image: {
                                                fileID: -1,
                                                name: null,
                                                hash: null,
                                                mimeType: null,
                                                type: null,
                                                size: null,
                                                lastModified: null,
                                            },
                                            admin: userID == 23 
                                        }

                                    

                                        session.sql(`UPDATE arcturus.user SET userPasswordCheckCount = 0, userPasswordLastChecked = NOW() WHERE userID = ${loginUser.userID}`).execute().then((updated) => {
                                            if (userFileID == null) {
                                              
                                                resolve({ success: true, user: loginUser, userSocket: userSocket, userCode: codeHex })
                                         

                                            } else {
                                                getOwnUserFile(userFileID, session).then((imageFile) => {
                                                    loginUser.image = imageFile
                                
                                                    
                                                    resolve({ success: true, user: loginUser, userSocket: userSocket, userCode: codeHex })
                                                   
                                                })
                                            }
                                            
                                        })
                                    })
                                }
                            });
                        }
                        
                    })
                
               
            })
        } catch (reason) {
            console.log(reason);
            resolve({ error: new Error("DB error") })

        }
    })
}
const sendEmailCode = (userID, callback) => {
    console.log("sending email code")
    var date = formatedNow();
    const keyString = aesjs.utils.hex.fromBytes(serverKey)
    
    generateCode(userID + keyString, 6).then((veriCode) => {

        mySession.then((session) => {

            var arcDB = session.getSchema('arcturus');
            var userTable = arcDB.getTable("user");


            session.startTransaction();
            try {

                userTable.select(['userName', "userEmail"]).where("user.userID = :userID AND HOUR(TIMEDIFF(now(), userEmailLastChanged))>24").bind("userID", userID).execute().then((value) => {
                    const one = value.fetchOne();


                    if (one !== undefined) {
                        const userName = one[0];
                        const userEmail = one[1];




                        const modifiedString = date;

                        userTable.update().set(
                            'userRecoveryCode', veriCode
                        ).set(
                            'userModified', modifiedString
                        ).where(
                            "userID = :userID"
                        ).bind("userID", userID).execute().then((res) => {
                            if (res.getAffectedItemsCount() > 0) {
                                emailPassReset(userName, userEmail, veriCode, (err, info) => {
                                    if (err) {
                                        throw ("unable to send email")
                                    } else {
                                        callback({ success: true })
                                    }
                                })
                            } else {

                                session.rollback();
                                callback({ error: new Error("Cannot update user") });

                            }
                        })

                        session.commit();
                    } else {

                        session.rollback();
                        callback({ error: new Error("Cannot update user") });
                    }
                })
            } catch (error) {
                console.log(error)
                session.rollback();
                callback({ error: error });
            }
        })
    })


}

const sendRecoveryEmail = (email, callback) => {
    var date = new Date().toString();
    
    generateCode(email, 6 ).then((veriCode) =>{

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
    })
}

const updateUserPassword = (userID, info, callback) => {
    console.log("update password", userID)
   
    const password = info.password

    bcryptPass(password).then((bcryptedPass)=>{

        mySession.then((session) => {

            var arcDB = session.getSchema('arcturus');
            var userTable = arcDB.getTable("user");
            const modifiedString = formatedNow();

        
            const userEmail = info.email;
            const code = info.code;

            session.startTransaction();
            try {
                userTable.update().set(
                    "userPasswordCheckCount", 0
                )
                .set(
                    'userPassword', bcryptedPass
                ).set(
                    'userModified', modifiedString
                ).where(
                    "userID = :userID AND userEmail = :userEmail AND userRecoveryCode = :code AND user.userEmailLastChanged < NOW() - INTERVAL 24 HOUR "
                ).bind(
                    "userID", userID
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
    })
}

const updateUserPasswordAnon = (info, callback) => {

    const password = info.password;

    encryptHex(password).then((encryptedPass) =>{

        mySession.then((session) => {

            var arcDB = session.getSchema('arcturus');
            var userTable = arcDB.getTable("user");
            const modifiedString = formatedNow();

        
            const userEmail = info.email;
            const code = info.code;

            session.startTransaction();
            try {
                userTable.update().set(
                    'userPassword', encryptedPass
                ).set(
                    'userModified', modifiedString
                ).where(
                    "userEmail = :userEmail AND userRecoveryCode = :code AND user.userEmailLastChanged < NOW() - INTERVAL 24 HOUR "
                ).bind(
                    "userID", userID
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
    })
}
/*
const checkUserFiles = (userID, hashs, callback) =>{
    mySession.then((session) => {
        let i = 0;
        let passedHashs = []
        const checkFileRecursive = () =>
        {
            const hash = hashs[i]
            const query = "SELECT DISTINCT file.fileID from arcturus.file, arcturus.userFile where file.fileID = userFile.fileID AND userFile.userID = " + userID + " \
 AND file.fileHash = " + hash;
            session.sql(query).execute.then((sqlResult)=>{
                if(sqlResult.hasData()){
                    const one = sqlResult.fetchOne()
                    const fileID = one[0]
                    passedHashs.push({fileID:fileID, hash:hash, index: i}) 
                
                }
                i++;
                if(i < hashs.length){ 
                    checkFileRecursive()
                }else{
                    callback({success:true, userFiles:passedHashs})
                }
            })
        }
        if(Array.isArray(hashs) && hashs.length > 0) checkFileRecursive()
    }).catch((err)=>{
        console.log(err)
        callback({error: new Error("DB error")})
    })
}*/

const updateStorageConfig = (fileID, fileInfo, callback) => {
    console.log("updating storage config: " + fileID + "hash: " + fileInfo.hash)
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var fileTable = arcDB.getTable('file')

        fileTable.update().set(
            "fileName", fileInfo.name
        ).set(
            "fileHash", fileInfo.hash
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
        ).execute().then((fileUpdateResult) => {
            const result = fileUpdateResult.getAffectedItemsCount()

            callback({ success: result > 0 })
        }).catch((err) => {
            console.log(err);
            callback({ error: new Error("DB error") })
        })

    })
}
/*
const createStorage = (userID, fileInfo, storageKey, callback) => {


    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var storageTable = arcDB.getTable("storage");
        var fileTable = arcDB.getTable("file")

        console.log(fileInfo)

        fileTable.insert(
            ["fileName", "fileHash", "fileSize", "fileType", "fileMimeType", "fileLastModified"]
        ).values(
            [fileInfo.name, fileInfo.hash, fileInfo.size, fileInfo.type, fileInfo.mimeType, fileInfo.lastModified]
        ).execute().then((fileInsert) => {
            if (fileInsert.getAffectedItemsCount > 0) {
                callback({ error: new Error("File not added.") })
            } else {
                const fileID = fileInsert.getAutoIncrementValue()
                console.log(fileID)
                storageTable.insert(
                    ['storageKey', "statusID", "fileID", "userID"]
                ).values(
                    [storageKey, status.Offline, fileID, userID]
                ).execute().then((res) => {
                    const affected = res.getAffectedItemsCount();

                    if (affected > 0) {
                        const storageID = res.getAutoIncrementValue()

                        callback({ success: true, storageID: storageID, fileID: fileID })
                    } else {
                        callback({ success: false })
                    }

                }).catch((err) => {
                    console.log(err)

                    callback({ error: new Error("Storage not created") })
                })
            }
        }).catch((err) => {
            console.log(err)
            callback({ error: new Error("Storage not created") })
        })



    }).catch((err) => {
        console.log(err)
        callback({ error: new Error("Storage not created") })
    })
}

const loadStorage = (hash, engineKey, callback) => {
    hash = mysql.escape(hash);
    engineKey = mysql.escape(engineKey);

    mySession.then((session) => {
        const query = "select storage.storageID, storage.fileID from arcturus.storage, arcturus.file where file.fileHash = " + hash + " \
AND storage.storageKey = " + engineKey;

        session.sql(query).execute().then((loaded) => {
            if (loaded.hasData()) {
                const info = loaded.fetchOne();
                const storageID = info[0];
                const fileID = info[1];

                callback({ success: true, storageID: storageID, fileID: fileID })
            } else {
                callback({ error: new Error("No storage.") })
            }
        })
    }).catch((err) => {
        console.log(err)
        callback({ error: new Error("DB error") })
    })

}*/






function formatedNow() {
    
    return moment().format('DD-MM-YYYY HH:mm:ss')



}


/*

const checkStorageHash = (userID, hash, callback) => {
    console.log("checking storageHash " + hash)
    mySession.then((session) => {

        const arcDB = session.getSchema("arcturus");
        const fileTable = arcDB.getTable("file");
        const storageTable = arcDB.getTable("storage");


        fileTable.select(["fileID"]).where("fileHash = :fileHash").bind("fileHash", hash).execute().then((fileResult) => {

            const one = fileResult.fetchOne()
            if (one != undefined) {
                const fileID = one[0];

                storageTable.select(["storageID"]).where("fileID = :fileID AND userID = :userID").bind("fileID", fileID).bind("userID", userID).execute().then((storageResult) => {

                    const row = storageResult.fetchOne()

                    if (row != undefined) {
                        const storageID = row[0];
                        console.log("storageHash passed")
                        callback({ success: true, fileID: fileID, storageID: storageID })
                    } else {
                        console.log("no storage ID for file")
                        callback({ success: false, fileID: fileID, storageID: null })
                    }

                }).catch((err) => {
                    console.log(err)
                    callback({ error: new Error("DB error") })
                })


            } else {
                callback({ error: new Error("File Hash failed.") })
            }

        }).catch((err) => {
            console.log(err)
            callback({ error: new Error("DB error") })
        })

    })
}


const useConfig = (userID, fileID, callback) => {
    mySession.then((session) => {

        const arcDB = session.getSchema("arcturus");
        const storageTable = arcDB.getTable("storage");

        storageTable.select(["storageID"]).where("userID = :userID AND fileID =:fileID")

        storageTable.insert(["userID", "fileID", "storageKey", "statusID",]).values(
            userID, fileID, storageKey, status.Offline,
        ).execute().then((storageInsert) => {
            const affected = storageInsert.getAffectedItemsCount()

            if (affected > 0) {
                const storageID = storageInsert.getAutoIncrementValue();

                callback({ success: true, storageID: storageID })
            } else {
                callback({ success: false })
            }
        }).catch((err) => {
            console.log(err)
            callback({ error: new Error("DB error") })
        })

    })
}*/

const selectFileTableHash = (fileTable, hash) => {
    return new Promise(resolve => {
        console.log("hashLength:" + hash.length)
        fileTable.select(["fileID"]).where("fileHash = :fileHash").bind("fileHash", hash).execute().then((selectRes) => {
            const one = selectRes.fetchOne()
            if (one != undefined) {
                resolve({ fileID: one[0] })
            } else {
                resolve({ fileID: null })
            }
        })
    })

}

const checkFileHash = (hash, callback) => {
    if (hash == undefined || hash == null || hash == "" || hash.length < 128) {
        callback(undefined)
    } else {
        mySession.then((session) => {

            var arcDB = session.getSchema('arcturus');
            var fileTable = arcDB.getTable("file");

            selectFileTableHash(fileTable, hash).then((result) => {
                callback(result)
            })

        }).catch((err) => {
            console.log(err)
            callback({ error: new Error("DB error") })
        })
    }

}




const checkRealmName = (name, callback) => {
    mySession.then((session) => {

        var arcDB = session.getSchema('arcturus');
        var realmTable = arcDB.getTable("realm");


        realmTable.select(["realmName"]).where("realmName = :realmName").bind(
            "realmName", name
        ).execute().then((result) => {
            if (result.fetchOne() == undefined) {
                callback(true)
            } else {
                callback(false)
            }
        }).catch((err) => {
            console.log(err)
            callback(false)
        })
    })
}

const checkUserFileTable = (userFileTable, userID, fileID) => {

    return new Promise(resolve => {
        userFileTable.select(["accessID"]).where(
            "userID = :userID AND fileID = :fileID"
        ).bind(
            "userID", userID
        ).bind(
            "fileID", fileID
        ).execute().then((result) => {
            const one = result.fetchOne();
            console.log(one)
            if (one == undefined) {
                resolve({ success: false })
            } else {
                resolve({ success: true, accessID: one[0] })
            }
        })
    })

}

const addFileToRealm = (userID, realmID, fileInfo, callback) => {
    mySession.then((session) => {

        const arcDB = session.getSchema('arcturus');
        const fileTable = arcDB.getTable("file")
        const realmFileTable = arcDB.getTable("realmFile")
        const realmTable = arcDB.getTable("realm");

        realmTable.select(["userID"]).where("userID = :userID").bind("userID", userID).execute().then((realmSelect) => {
            const one = realmSelect.fetchOne()

            if (one != undefined) {
                checkFileHash(fileInfo.hash, (result) => {
                    const fileID = result.fileID;
                    session.startTransaction()
                    if (fileID == null) {

                        fileTable.insert(
                            ["fileName", "fileHash", "fileSize", "fileType", "fileMimeType", "fileLastModified"]
                        ).values(
                            [fileInfo.name, fileInfo.hash, fileInfo.size, fileInfo.type, fileInfo.mimeType, fileInfo.lastModified]
                        ).execute().then((fileInsert) => {

                            const fileID = fileInsert.getAutoIncrementValue()

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
                        checkRealmFile(realmID, fileID, (crfResult) => {
                            if ("error" in crfResult) {
                                session.rollback();
                                callback({ error: crfResult.error })
                            } else {
                                if (crfResult.success) {
                                    const realmFileID = crfr.realmFileID
                                    fileInfo.fileID = fileID;
                                    fileInfo.realmFileID = realmFileID;
                                    callback({ success: true, file: fileInfo })
                                } else {
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
            } else {
                callback({ success: false, msgCode: status.invalid })
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
    mySession.then((session) => {
        const arcDB = session.getSchema("arcturus")
        const realmFileTable = arcDB.getTable("realmFile")

        realmFileTable.select(["realmFileID"]).where("fileID = :fileID and realmID = :realmID").bind("fileID", fileID).bind("realmID", realmID).execute().then((realmFileSelect) => {
            const rfsOne = realmFileSelect.fetchOne()
            if (rfsOne == undefined) {

                callback({ success: false, realmFileID: null })
            } else {
                const realmFileID = rfsOne[0]
                callback({ success: true, realmFileID: realmFileID })
            }
        }).catch((err) => {
            console.log(err)
            callback({ error: new Error("DB error") })
        })
    })
}

const insertFile = (fileTable, fileInfo) => {
    return new Promise(resolve => {
        fileTable.insert(
            ["fileName", "fileHash", "fileSize", "fileType", "fileMimeType", "fileLastModified"]
        ).values(
            [fileInfo.name, fileInfo.hash, fileInfo.size, fileInfo.type, fileInfo.mimeType, fileInfo.lastModified]
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

        const insertRealm = (innerRealmTable, realmName, userID, imageID, page, index, roomID, gatewayRoomID) => {
            return new Promise(resolve => {

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





        try {
            session.startTransaction()

            createRoom(roomTable, userRoomTable, userID, realmName).then((roomResult) => {
                if (!roomResult.success) throw new Error("room not created")

                const roomID = roomResult.room.roomID
                createRoom(roomTable, userRoomTable, userID, realmName).then((gatewayRoomResult) => {
                    if (!gatewayRoomResult.success) throw new Error("gateway room not created")

                    const gatewayRoomID = gatewayRoomResult.room.roomID

                    if (roomID != undefined && gatewayRoomID != undefined) {
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
                        checkFileHash(imageFile.hash, (hashResult) => {
                            if ("error" in hashResult) {
                                session.rollback()
                                callback({ error: "Error in hash result" })
                            } else {
                                if (hashResult.fileID == null) {
                                    insertFile(fileTable, imageFile).then((imageFileInfo) => {
                                        const imageID = imageFileInfo.fileID;

                                        insertRealm(realmTable, realmName, userID, imageID, page, index, roomID, gatewayRoomID).then((realmID) => {

                                            realm.image = imageFileInfo;
                                            realm.realmID = realmID;
                                            session.commit()
                                            callback({ success: true, realm: realm })
                                        })
                                    })


                                } else {
                                    insertRealm(realmTable, realmName, userID, hashResult.fileID, page, index, roomID, gatewayRoomID).then((realmID) => {
                                        if (realmID != undefined) {
                                            imageFile.fileID = hashResult.fileID;
                                            realm.image = imageFile;
                                            realm.realmID = realmID;
                                            session.commit()
                                            callback({ success: true, realm: realm })
                                        }
                                    })
                                }
                            }

                        })

                    } else {
                        session.rollback()
                        callback({ error: new Error("Error adding room.") })
                    }
                })
            })

        } catch (err) {
            console.log(err)
            session.rollback()
            callback({ error: new Error("Unable to create realm.") })
        }


    })
}

const getRealms = (userID, callback) => {
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
 image.fileHash, \
 image.fileMimeType, \
 image.fileSize, \
 image.fileLastModified, \
 config.fileID, \
 config.fileName, \
 config.fileHash, \
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



        session.sql(query).execute().then((selectResult) => {

            if (selectResult.hasData()) {
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
                            hash: value[9],
                            mimeType: value[10],
                            size: value[11],
                            lastModified: value[12],

                        },
                        config: {
                            fileID: value[13],
                            name: value[14],
                            hash: value[15],
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
                        gatewayRoomID: value[23]

                    };

                    realms.push(realm);
                });



                callback({ success: true, realms: realms })
            } else {
                callback({ success: false })
            }
        }).catch((err) => {
            console.log(err)

            callback({ error: new Error("DB error") })
        })
    })

}
const getUserSocket = (userID, callback) => {
    mySession.then((session) => {
        const arcDB = session.getSchema("arcturus")
        const userTable = arcDB.getTable("user")

        userTable.select(["userSocket"]).where("userID = :userID").bind("userID", userID).then((userSelect) => {
            const one = userSelect.fetchOne()
            if (one != undefined) {
                const userSocket = one[0]
                if (userSocket == "") {
                    callback(null)
                } else {
                    callback(userSocket)
                }
            } else {
                callback(null)
            }
        }).catch((err) => {
            callback(null)
        })
    })
}

const deleteRealm = (userID, realmID, callback) => {

    mySession.then((session) => {
        //to get more complicated?

        var arcDB = session.getSchema("arcturus")
        const realmUserFile = arcDB.getTable("realmUserFile")
        var realmTable = arcDB.getTable("realm")
        const roomTable = arcDB.getTable("room")
        const userRoomTable = arcDB.getTable("userRoom")
        const realmUserTable = arcDB.getTable("realmUser")

        console.log("deleting realm: " + realmID + " by userID: " + userID)

        realmTable.select(["roomID", "gatewayRoomID"]).where("userID = :userID and realmID = :realmID").bind("userID", userID).bind("realmID", realmID).execute().then((realmSelect) => {
            const rsOne = realmSelect.fetchOne()
            if (rsOne != undefined) {
                const roomID = rsOne[0]
                const gatewayRoomID = rsOne[1]

                realmUserTable.select(["userID",]).where("realmID = :realmID").bind("realmID", realmID).execute().then((realmUserSelect) => {
                    const rusrs = realmUserSelect.fetchAll()
                    session.startTransaction()
                    try {
                        let realmUsers = []
                        rusrs.forEach(realmUser => {
                            const realmUserID = realmUser[0];
                            realmUsers.push({ userID: realmUserID })

                        });

                        realmUserFile.delete().where("realmID = :realmID").bind("realmID", realmID).execute();
                        realmUserTable.delete().where("realmID = :realmID").bind("realmID", realmID).execute()

                        realmTable.delete().where("userID = :userID AND realmID = :realmID").bind("userID", userID).bind("realmID", realmID).execute().then((deleted) => {
                            const affectedRealms = deleted.getAffectedItemsCount();
                            userRoomTable.delete().where("roomID = :roomID").bind("roomID", roomID).execute();
                            userRoomTable.delete().where("roomID = :roomID").bind("roomID", gatewayRoomID).execute();
                            roomTable.delete().where("roomID = :roomID").bind("roomID", roomID).execute();
                            roomTable.delete().where("roomID = :roomID").bind("roomID", gatewayRoomID).execute();

                            callback({ success: affectedRealms > 0, realmUsers: realmUsers })
                        })
                        session.commit()
                    } catch (err) {
                        console.log(err)
                        session.rollback()
                        callback({ error: new Error("realm delete DB error") })
                    }



                })

            }
        })


    })

}


const updateRealmInformation = (information, callback) => {
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
            "realmType", realmType
        ).where("realmID = :realmID").bind("realmID", realmID).execute().then((realmUpdateResult) => {
            const affected = realmUpdateResult.getAffectedItemsCount()
            if (affected > 0) {
                callback({ success: true })
            } else {
                callback({ sucess: false })
            }
        }).catch((err) => {
            console.log(err)
            callback({ error: new Error("DB error") })
        })
    })
}



const enterRealmGateway = (user, realmID, socket, callback) => {



    mySession.then((session) => {

        const arcDB = session.getSchema('arcturus');
        const realmTable = arcDB.getTable("realm");
        const userRoomTable = arcDB.getTable("userRoom");
        const userContactTable = arcDB.getTable("userContact")
        const fileTable = arcDB.getTable("file")
        const messageTable = arcDB.getTable("message")
        const userTable = arcDB.getTable("user")

        const finalize = (admin, userRoomTable, userTable, contactList, userID, gatewayRoomID, roomID) => {
            return new Promise(resolve => {
                getRoomUsers(session, userRoomTable, userTable, contactList, gatewayRoomID).then((gatewayRoomResult) => {
                    if (!("success" in gatewayRoomResult)) throw new Error("getgatewayRoomUsers not successfull")

                    const gatewayUsers = gatewayRoomResult.users

                    getRoomUsers(session, userRoomTable, userTable, contactList, roomID).then((realmRoomResult) => {
                        if (!("success" in gatewayRoomResult)) throw new Error("getRoomUsers not successfull")

                        const realmUsers = realmRoomResult.users

                        const index = realmUsers.findIndex(search => search.userID == user.userID)

                        const realmMember = index > 0

                        getStoredMessages(messageTable, gatewayRoomID).then((messagesResult) => {

                            setUserRoomStatus(userRoomTable, userID, gatewayRoomID, status.Online).then((statusUpdated) => {

                                io.to(gatewayRoomID).emit("userRoomStatus", userID, status.Online);
                                socket.join(gatewayRoomID)

                                resolve({ admin: admin, realmMember: realmMember, success: true, gatewayUsers: gatewayUsers, realmUsers: realmUsers, gatewayMessages: messagesResult.messages });
                            })
                        })
                    })

                })

            })
        }

        realmTable.select(["userID", "accessID", "gatewayRoomID", "roomID"]).where("realmID = :realmID").bind("realmID", realmID).execute().then((realmSelect) => {
            const oneRealm = realmSelect.fetchOne()

            if (oneRealm == undefined) {
                callback({ success: false })
            } else {
                userContactTable.select(["userID"]).where("contactID = :userID").bind("userID", user.userID).execute().then((contactResult) => {
                    const contactArray = contactResult.fetchAll()
                    const contactIDList = []
                    contactArray.forEach(contact => {
                        const contactID = contact[0];
                        contactIDList.push(contactID)
                    });

                    const realmAdminID = oneRealm[0];
                    const accessID = oneRealm[1];
                    const gatewayRoomID = oneRealm[2]
                    const roomID = oneRealm[3]
                    const admin = realmAdminID == user.userID;

                    userRoomTable.select(["userRoomBanned"]).where("userID =:userID and roomID = :roomID").bind("userID", user.userID).bind("roomID", gatewayRoomID).execute().then((userRoomSelect) => {
                        const oneUserRoom = userRoomSelect.fetchOne()
                        if (!admin) {
                            if (oneUserRoom == undefined) {
                                switch (accessID) {
                                    case access.private:
                                        callback({ success: "false" })
                                        break;
                                    case access.contacts:
                                        userContactTable.select(["userID"]).where("userID = :userID and contactID = :contactID").bind("userID", realmAdminID).bind("contactID", user.userID).execute().then((userContactSelect) => {
                                            const ucsOne = userContactSelect.fetchOne()
                                            if (ucsOne == undefined) {
                                                callback({ success: "false" })
                                            } else {
                                                addUserToRoom(userRoomTable, user.userID, gatewayRoomID).then((added) => {
                                                    if (added) {

                                                        finalize(admin, userRoomTable, userTable, contactIDList, user.userID, gatewayRoomID, roomID).then(result => {
                                                            callback(result)
                                                        })

                                                    } else {
                                                        callback({ success: "false" })
                                                    }
                                                })
                                            }
                                        })
                                        break;
                                    case access.public:
                                        addUserToRoom(userRoomTable, user.userID, gatewayRoomID).then((added) => {
                                            if (added) {

                                                finalize(admin, userRoomTable, userTable, contactIDList, user.userID, gatewayRoomID, roomID).then(result => {
                                                    callback(result)
                                                })

                                            } else {
                                                callback({ success: "false" })
                                            }
                                        })
                                        break;
                                }
                            } else {
                                const banned = oneUserRoom[0]
                                if (banned == 0) {
                                    finalize(admin, userRoomTable, userTable, contactIDList, user.userID, gatewayRoomID, roomID).then(result => {
                                        callback(result)
                                    })
                                } else[
                                    callback({ success: "false" })
                                ]
                            }

                        } else {
                            if (oneUserRoom == undefined) {
                                addUserToRoom(userTable, userRoomTable, fileTable, user.userID, gatewayRoomID).then((added) => {
                                    if (added) {
                                        finalize(admin, userRoomTable, userTable, fileTable, user.userID, gatewayRoomID, roomID).then(result => {
                                            callback(result)
                                        })
                                    } else {
                                        console.log("admin couldn't be added to gateway room")
                                        callback({ error: new Error("error joining room") })
                                    }
                                })
                            } else {
                                finalize(admin, userRoomTable, userTable, fileTable, user.userID, gatewayRoomID, roomID).then(result => {
                                    callback(result)
                                })
                            }


                        }
                    })
                })
            }
        })

    })

}

const updateUserPeerID = (userID, peerID, callback) => {

    mySession.then((session) => {

        const arcDB = session.getSchema('arcturus');
        const userTable = arcDB.getTable("user")
        const userRoom = arcDB.getTable("userRoom")

        userTable.update().set("userPeerID", peerID).where("userID = :userID").bind("userID", userID).execute().then((userUpdate) => {
            const updated = userUpdate.getAffectedItemsCount() > 0

            if (updated) {
                userRoom.select(["roomID"]).where("userID = :userID and statusID = :statusID").bind("userID", userID).bind("statusID", status.Online).execute().then((userRoomSelect) => {

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

const insertUserFile = (userFileTable, userID, fileID, title, text, accessID, userAccess) => {

    return new Promise(resolve => {
        userFileTable.insert(["userID", "fileID", "userFileTitle", "userFileText", "accessID", "userFileUserAccess"]).values([
            userID, fileID, title, text, accessID, userAccess
        ]).execute().then((result) => {

            resolve(result.getAutoIncrementValue())

        })
    })
}
const updateUserFile = (userFileTable, userFileID, title, text, accessID, userAccess) => {

    return new Promise(resolve => {
        userFileTable.update().set("userFileTitle", title).set("userFileText", text).set("accessID", accessID).set("userFileUserAccess", userAccess).where("userFileID = :userFileID").bind("userFileID", userFileID).execute().then((result) => {

            resolve(result.getAffectedItemsCount() > 0)

        })
    })
}

const addUpdateUserFile = (userFileTable, userID, fileInfo) => {
    return new Promise(resolve => {
        userFileTable.select(["userFileID"]).where("userID = :userID AND fileID = :fileID").bind("userID", userID).bind("fileID", fileInfo.fileID).execute().then((userFileSelectResult) => {
            const userFileIDSelect = userFileSelectResult.fetchOne()

            /*fileInfo = {
                name: file.name,
                hash: file.hash,
                size: file.size,
                type: file.type,
                mimeType: file.mimeType,
                lastModified: file.lastModified,
                title: title,
                text: text,
                accessID: accessID,
                userAccess: userAccess
            }*/

            const accessID = fileInfo.accessID
            const userAccess = fileInfo.userAccess
            const title = fileInfo.title
            const text = fileInfo.text

            if (userFileIDSelect == undefined) {
                insertUserFile(userFileTable, userID, fileInfo.fileID, title, text, accessID, userAccess).then((insertID) => {
                    fileInfo.accessID = accessID;
                    fileInfo.userFileID = insertID;
                    fileInfo.userAccess = userAccess
                    fileInfo.title = title
                    fileInfo.text = text
                    resolve({ file: fileInfo, userFileID: insertID, update: false })
                })
            } else {
                const userFileID = userFileIDSelect[0]
                updateUserFile(userFileTable, userFileID, title, text, accessID, userAccess).then((updated) => {
                    console.log(updated)
                    if (updated) {
                        fileInfo.accessID = accessID;
                        fileInfo.userFileID = userFileID;
                        fileInfo.userAccess = userAccess;
                        fileInfo.title = title
                        fileInfo.text = text
                    }

                    resolve({ file: fileInfo, userFileID: userFileID, update: updated })
                })
            }
        })
    })
}

const userTableImageUpdate = (userTable, userID, userFileID) => {
    return new Promise(resolve => {
        userTable.update().set("userFileID", userFileID).where("userID = :userID").bind("userID", userID).execute().then((userImageUpdated) => {
            resolve(userImageUpdated.getAffectedItemsCount() > 0)
        })
    })
}
const updateUserImage = (userID, imageInfo, callback) => {
    console.log("updating user Image " + imageInfo.name)

    if ((imageInfo != undefined && imageInfo.hash != undefined && imageInfo.hash != null && imageInfo.hash != "" && imageInfo.hash.length > 5)) {
        mySession.then((session) => {

            const arcDB = session.getSchema('arcturus');
            const userTable = arcDB.getTable("user")
            const fileTable = arcDB.getTable("file")
            const userFileTable = arcDB.getTable("userFile")





            selectFileTableHash(fileTable, imageInfo.hash).then((hashResult) => {
                const fileID = hashResult.fileID != undefined ? hashResult.fileID : null;

                if (fileID != null) {
                    imageInfo.fileID = fileID

                    addUpdateUserFile(userFileTable, userID, imageInfo).then((userFileUpdate) => {

                        const userFileID = userFileUpdate.userFileID

                        userTableImageUpdate(userTable, userID, userFileID).then((updated) => {


                            callback({ success: true, file: userFileUpdate.file, updated: updated })
                        })
                    })


                } else {
                    insertFile(fileTable, imageInfo).then((iFile) => {
                        const fileID = iFile.fileID;
                        imageInfo.fileID = fileID
                        addUpdateUserFile(userFileTable, userID, imageInfo).then((userFileUpdate) => {

                            const userFileID = userFileUpdate.userFileID

                            userTableImageUpdate(userTable, userID, userFileID).then((updated) => {


                                callback({ success: true, file: userFileUpdate.file, updated: updated })
                            })

                        })
                    })
                }
            })

        })
    } else {
        console.log("invalid hash")
        callback({ error: "Hash invalid." })
    }
}

const realmTableImageUpdate = (realmTable, userID, realmID, fileID) => {
    return new Promise(resolve => {
        realmTable.select(["accessID"]).where("userID = :userID AND realmID = :realmID").bind("userID", userID).bind("realmID", realmID).execute().then((realmSelect) => {
            const accessID = realmSelect.fetchOne()
            if (accessID != undefined) {
                realmTable.update().set("imageID", fileID).where("userID = :userID AND realmID = :realmID").bind("userID", userID).bind("realmID", realmID).execute().then((realmUpdate) => {
                    resolve({ success: realmUpdate.getAffectedItemsCount() > 0 })
                })
            }
        })
    })
}

const updateRealmImage = (userID, realmID, imageInfo, callback) => {
    console.log("updating realm Image" + imageInfo.name)
    if ((imageInfo.hash != null && imageInfo.hash != "")) {
        mySession.then((session) => {

            const arcDB = session.getSchema('arcturus');
            const fileTable = arcDB.getTable("file")
            const realmTable = arcDB.getTable("realm")

            selectFileTableHash(fileTable, imageInfo.hash).then((hashResult) => {
                const fileID = hashResult.fileID != undefined ? hashResult.fileID : null;

                if (fileID != null) {

                    realmTableImageUpdate(realmTable, userID, realmID, fileID).then((updated) => {

                        imageInfo.fileID = fileID
                        console.log(imageInfo)
                        callback({ success: true, file: imageInfo, updated: updated })
                    })

                } else {
                    insertFile(fileTable, imageInfo).then((iFile) => {
                        const fileID = iFile.fileID;

                        realmTableImageUpdate(realmTable, userID, realmID, fileID).then((updated) => {

                            imageInfo.fileID = fileID
                            console.log(imageInfo)
                            callback({ success: true, file: imageInfo, updated: updated })
                        })


                    })
                }
            })

        })
    } else {
        console.log("invalid hash")
        callback({ error: "Hash invalid." })
    }
}

const selectUserContactTableUserIDs = (userContactTable, userID) => {
    return new Promise(resolve => {
        userContactTable.select(["userID"]).where("contactID = :userID").bind("userID", userID).execute().then((contactsSelect) => {
            const contactsArray = contactsSelect.fetchAll()

            if (contactsArray != undefined) {
                let userIDs = []
                contactsArray.forEach(user => {
                    userIDs.push(user[0])
                });
                resolve(userIDs)
            } else {
                resolve([])
            }

        })
    })
}
const updateUserEmail = (userID, params) => {
    return new Promise(resolve => {
        const email = params.email
        const now = formatedNow()

        mySession.then((session) => {

            const arcDB = session.getSchema('arcturus');
            const userTable = arcDB.getTable("user")

            userTable.update().set("userEmail", email).where("userID = :userID").bind("userID", userID).execute().then((userEmailUpdate) => {

                const affected = userEmailUpdate.getAffectedItemsCount() > 0

                session.sql(`update arcturus.user SET userModified = now(), userEmailLastChanged = now())`)
                resolve({ success: affected })

            })
        })
    })
}


const updateUserAccess = (userID, params) => {
    console.log("updating user access")
    return new Promise(resolve => {
        const accessID = params.accessID
        const now = formatedNow()

        if (accessID > -1 && accessID < 3) {
            mySession.then((session) => {

                const arcDB = session.getSchema('arcturus');
                const userTable = arcDB.getTable("user")

                userTable.update().set("accessID", accessID).set("userModified", now).where("userID = :userID").bind("userID", userID).execute().then((userAccessUpdate) => {
                    const affected = userAccessUpdate.getAffectedItemsCount() > 0

                    resolve({ success: affected })

                })
            })
        } else {
            resolve({ error: new Error("Value out of range.") })
        }
    })
}

const getFilePeers = (userID, fileID, callback) => {

    console.log("looking for fileID: " + fileID)
    if (fileID != undefined && fileID != null && fileID > -1) {
        /*
  (user.userID <> " + userID + " AND user.accessID > 0 AND user.userID = userFile.userID AND userFile.fileID = " + fileID + ") OR \
  (user.userID <> " + userID + " AND realm.accessID > 0 AND realm.userID = user.userID AND realm.imageID = " + fileID + ") OR \
  (user.userID <> " + userID + " AND realm.accessID > 0 AND realm.userID = user.userID AND realm.reamID = realmFile.realmID AND realmFile.fileID =" + fileID + ") "*/

        mySession.then((session) => {
            const arcDB = session.getSchema("arcturus")
            const userContactTable = arcDB.getTable("userContact")

            selectUserContactTableUserIDs(userContactTable, userID).then((accessableContactIDs) => {


                const selectPeerQuery = `
SELECT DISTINCT
 userFile.userFileID,
 user.statusID, 
 user.userLastOnline,
 user.userID
FROM 
 arcturus.user, 
 arcturus.userFile 
WHERE 
   userFile.fileID = ${fileID} AND userFile.userID = user.userID AND user.userID <> ${userID} AND userFile.accessID = ${access.public} 
   AND 
  ( 
    ( user.userLastOnline BETWEEN DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND DATE(NOW()) ) 
  OR 
    ( user.statusID = ${status.Online} )
  )
 OR 
(
 userFile.fileID = ${fileID} AND userFile.userID = user.userID AND user.userID <> ${userID} AND userFile.accessID = ${access.contacts} 
 AND
 user.userID IN (SELECT userContact.userID FROM arcturus.userContact WHERE userContact.contactID = ${userID}) 
 AND 
 ( 
  ( userLastOnline BETWEEN DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND DATE(NOW()) ) 
  OR 
  ( user.statusID = ${status.Online} )
))
 OR 
(
 userFile.fileID = ${fileID} AND userFile.userID = user.userID AND user.userID <> ${userID} 
 AND
 userFile.userFileUserAccess LIKE "%'${userID}'%"
 AND 
 ( 
  ( userLastOnline BETWEEN DATE(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND DATE(NOW()) ) 
  OR 
  (user.statusID = ${status.Online} )
))
 ORDER BY user.statusID DESC, user.userLastOnline ASC`

                session.sql(selectPeerQuery).execute().then((peerSelect) => {
                    const foundPeers = []

                    if (peerSelect.hasData()) {
                        const peerArray = peerSelect.fetchAll()
                        peerArray.forEach(peer => {
                            console.log(peer)
                            foundPeers.push({
                                userFileID: peer[0],
                                statusID: peer[1],
                                userLastOnline: peer[2],
                                userID: peer[3]
                            })
                        });
                    }
                    console.log("foundPeers")
                    console.log(foundPeers)
                    callback({ success: foundPeers.length > 0, peers: foundPeers })
                })



            })

        })

    } else {
        callback({ error: new Error("fileID invalid") })
    }

}

const peerFileRequest = (userID, params) => {
    return new Promise(resolve => {
        mySession.then((session) => {
            const request = params.request
            const contactID = params.contactID
            const userFileID = params.userFileID
            const userPeerID = params.userPeerID

            const arcDB = session.getSchema("arcturus")
            const userContactTable = arcDB.getTable("userContact")

            userContactTable.select(["statusID"]).where(`contactID = :userID and userID = :contactID and statusID = ${status.accepted}`).bind("userID", userID).bind("contactID", contactID).execute().then((contactResult) => {
                const isContact = contactResult.fetchOne() != undefined


                let query = `
SELECT DISTINCT 
 user.userSocket, 
 user.userID 
FROM 
 arcturus.userFile, 
 arcturus.user
WHERE 
(  
  user.userID = ${contactID} 
 AND 
  userFile.userID = user.userID
 AND 
  userFile.accessID = ${access.public} 
 AND 
  userFile.userFileID = ${userFileID} 
 AND 
  user.userSocket <> ""
 AND
  user.statusID = ${status.Online} 
) OR (
  user.userID = ${contactID} 
 AND 
  userFile.userID = user.userID
 AND
  userFile.userFileID = ${userFileID}
 AND 
  userFile.userFileUserAccess LIKE "'${userID}'"  
 AND 
  user.userSocket <> "" 
 AND 
  user.statusID = ${status.Online} 
)`

                if (isContact) {
                    query += ` OR ( user.userID = ${contactID} AND userFile.userID = user.userID AND userFile.accessID = ${access.contacts} AND userFile.userFileID = ${userFileID} AND user.userSocket <> '' AND user.statusID = ${status.Online} )`
                }


                session.sql(query).execute().then((socketSelect) => {
                    if (socketSelect.hasData()) {
                        console.log("file access available")
                        const one = socketSelect.fetchOne()

                        const contactSocket = one[0]
                        const contactID = one[1]


                        let socketOnline = false;

                        io.sockets.sockets.forEach((connectedSocket) => {

                            if (connectedSocket.id == contactSocket) {

                                socketOnline = true
                            }
                        });

                        if (socketOnline) {
                            io.to(contactSocket).timeout(500).emit("peerFileRequest", { request: request, peerID: userPeerID, userID: userID }, (err, response) => {
                                if (err) {
                                    resolve({ error: new Error("Unable to connect.") })
                                } else {

                                    resolve(response[0])
                                }

                            })
                        } else {
                            updateUserStatus(contactID, status.Offline, "", (complete) => { })
                            resolve({ error: new Error("Not online.") })
                        }
                    } else {
                        resolve({ error: new Error("File unavailable") })
                    }
                })
            })
        })
    })
}

const getUserFiles = (userID) => {
    return new Promise(resolve => {
        console.log("getting user files")
        mySession.then((session) => {
            const query = `
SELECT DISTINCT 
 file.fileID, file.fileName, file.fileHash, file.fileMimeType, file.fileType, file.fileSize, file.fileLastModified, userFile.userFileID, userFile.userFileTitle, userFile.userFileText 
FROM 
 arcturus.userFile, arcturus.file 
WHERE 
  userFile.userID = ${userID} 
 AND 
  file.fileID = userFile.fileID`

            session.sql(query).execute().then((userFileSelectResult) => {

                if (userFileSelectResult.hasData()) {
                    const allUserFiles = userFileSelectResult.fetchAll()


                    let userFiles = []

                    allUserFiles.forEach(userFile => {
                        const file = {
                            fileID: userFile[0],
                            name: userFile[1],
                            hash: userFile[2],
                            mimeType: userFile[3],
                            type: userFile[4],
                            size: userFile[5],
                            lastModified: userFile[6],
                            userFileID: userFile[7],
                            title: userFile[8],
                            text: userFile[9]
                        }
                        userFiles.push(file)
                    });

                    resolve(userFiles)

                } else {
                    resolve([])
                }
            })

        })
    })
}

const getPeerLibrary = (userID, params) => {
    return new Promise(resolve => {
        console.log("getting peer library")
        mySession.then((session) => {

            const contactID = params.contactID

            const contactQuery = `
SELECT statusID FROM arcturus.userContact WHERE userID = ${contactID} AND contactID = ${userID} AND statusID = ${status.accepted}`

            session.sql(contactQuery).execute().then((contactSelect) => {
                const isContact = contactSelect.hasData()




                let query = `
SELECT DISTINCT 
 file.fileID, file.fileName, file.fileHash, file.fileMimeType, file.fileType, file.fileSize, file.fileLastModified, userFile.userFileID, userFile.userFileTitle, userFile.userFileText 
FROM 
 arcturus.userFile, arcturus.file 
WHERE
 (
  userFile.accessID = ${access.public}
 AND
  userFile.userID = ${contactID} 
 AND 
  file.fileID = userFile.fileID 
 )`
                if (isContact) {
                    query = query.concat(
                        ` OR (
  userFile.accessID = ${access.contacts}
 AND
  userFile.userID = ${contactID} 
 AND 
  file.fileID = userFile.fileID 
 )`)
                }
                session.sql(query).execute().then((userFileSelectResult) => {

                    if (userFileSelectResult.hasData()) {
                        const allUserFiles = userFileSelectResult.fetchAll()


                        let userFiles = []

                        allUserFiles.forEach(userFile => {
                            const file = {
                                fileID: userFile[0],
                                name: userFile[1],
                                hash: userFile[2],
                                mimeType: userFile[3],
                                type: userFile[4],
                                size: userFile[5],
                                lastModified: userFile[6],
                                userFileID: userFile[7],
                                title: userFile[8],
                                text: userFile[9],
                            }
                            userFiles.push(file)
                        });

                        resolve({ success: true, files: userFiles })

                    } else {
                        resolve({ success: false })
                    }
                })
            })
        })
    })
}

const getAppList = (params) =>{
    return new Promise(resolve =>{
        


        mySession.then((session) => {

            




            const arcDB = session.getSchema("arcturus")
     
            const appsTable = arcDB.getTable("apps")

            
            resolve({success:true, apps:[]})
        })
    })
}

const getStorageKey = (userID, params) =>{
    return new Promise(resolve => {
        mySession.then((session) => {

            const arcDB = session.getSchema('arcturus');
            const storageTable = arcDB.getTable("user")
            const storageID = params.storageID

            storageTable.select(["storageKey"]).where("userID = :userID AND storageID = :storageID").bind("userID", userID).bind("storageID", storageID).execute().then((result)=>{
                const one = result.fetchOne()

               if(one != undefined){
                    resolve({success:true, storageKey: one[0]})
                }else{
                    resolve({success:false})
                }
            })
        })
    })
}
const checkStorageHash = (userID, params) => {
    console.log("checking storage hash")
    return new Promise(resolve => {
        mySession.then((session) => {
            const storageHash = params.storageHash
            
            const arcDB = session.getSchema('arcturus');
            const storageTable = arcDB.getTable("storage")

            storageTable.select(["storageID"]).where("userID = :userID AND storageHash = :storageHash").bind("userID", userID).bind("storageHash", storageHash).execute().then((result) => {
                const one = result.fetchOne()

                if (one != undefined) {
                    const storageID = one[0]
                    resolve({ success: true, storageID: storageID })
                } else {
                    resolve({ error: new Error("Incorrect Hash")})
                }
            })
        })
    })
}
const checkPassword = (userID, params) =>{
   
    return new Promise(resolve => {

        const passHex = params.passwordHash

        encryptHex(passHex).then((encryptedPass) => {

            mySession.then((session) => {

                const arcDB = session.getSchema('arcturus');
                const userTable = arcDB.getTable("user")

                userTable.select(["userPasswordCheckCount"]).where("userID = :userID AND userPassword = :password AND (userPasswordCheckCount < 30 OR HOUR(TIMEDIFF(NOW(), userPasswordLastChecked))>24)").bind("userID", userID).bind("password", encryptedPass).execute().then((result)=>{
                    const one = result.fetchOne()

                    if(one == undefined)
                    {
                        const count = one[0]
                    
                        session.sql(`UPDATE user SET userPasswordCheckCount = ${count + 1}, userPasswordLastChecked = NOW() WHERE userID = ${userID}`).execute().then((updated)=>{
                            
                            resolve(false)
                        })
                    
                    }else{
                        session.sql(`UPDATE user SET userPasswordCheckCount = 0, userPasswordLastChecked = NOW() WHERE userID = ${userID}`).execute().then((updated) => {

                            resolve(false)
                        })
                        resolve(true)
                    }
                })
            })
        })
    })
}


const createStorage = (userID, params) => {
    return new Promise(resolve => {
        
        
 

        mySession.then((session) => {

            const arcDB = session.getSchema('arcturus');
            const storageTable = arcDB.getTable("storage")
            
            console.log(userID)
            console.log(params)
            const storageKey =  params.storageKey
            const storageHash = params.storageHash
            

            storageTable.select(["userID"]).where("userID = :userID AND storageHash = :storageHash").bind("userID", userID).bind("storageHash", storageHash).execute().then((selectResult)=>{
                const one = selectResult.fetchOne()

                if(one == undefined)
                {
                    console.log("inserting")
                    storageTable.insert(["storageKey", "storageHash", "userID"]).values(storageKey, storageHash, userID).execute().then((result) => {
                        const storageID = result.getAutoIncrementValue()
                        if(storageID != undefined && storageID > 0){
                            resolve({ success: true })
                        }else{
                            resolve({error: new Error("undefined")})
                        }
                    })
                }else{
                    
                        resolve({success: false})
                    
                }
            })

            
        })
    })
}

function checkRefCodeEmail(params){
    return new Promise(resolve => {
    mySession.then((session) => {

        const arcDB = session.getSchema("arcturus")
        const refTable = arcDB.getTable("ref")
        const userTable = arcDB.getTable("user")

        const code = params.refCode
        const userEmail = params.userEmail 
    

        refTable.select(["refID"]).where("refCode = :refCode").bind("refCode", code).execute().then((result) => {
            const one = result.fetchOne()
            if (one == undefined) {
                console.log("refID not found", code)
                resolve({success:false});
            } else {
         
                const refID = one[0];


               userTable.select(["refID"]).where("refID = :refID").bind("refID", refID).execute().then((userRefSelect) => {
                    const userRefOne = userRefSelect.fetchOne()
                    if (userRefOne == undefined) {
                       

                        userTable.select(["userEmail"]).where("userEmail = :userEmail").bind("userEmail", userEmail).execute().then((emailSelect) => {
                            const emailSelectOne = emailSelect.fetchOne()
                            if (emailSelectOne == undefined) {
                          
                                resolve({ success: true });
                            } else {
                           
                                resolve({ success: false });
                            }
                        })
                      
                    }else{
                       console.log("refID used. No longer valid.")
                       resolve({ success: false });

                    }
                }).catch((reason) => {
                    console.log(reason);
                    resolve({ success: false });
                })
            } 
        })
    }, (reason) => {
        console.log(reason);
        resolve({ success: false });
    }).catch((reason) => {
        console.log(reason);
        resolve({ success: false });
    })
    })
}

const checkContextID = (contextID) =>{
    return new Promise(resolve =>{
        mySession.then((session) => {

            const arcDB = session.getSchema("arcturus")
            const contextTable = arcDB.getTable("context")

            contextTable.select(["contextBanned"]).where("contextID = :contextID AND contextBanned = 1").bind("contextID", contextID).execute().then((contextResult)=>{
                const one = contextResult.fetchOne()

                if(one == undefined)
                {
                    resolve(true)
                }else{
                    resolve(false)
                }
            })
        })
    })
}