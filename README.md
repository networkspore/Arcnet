# ArcturusNetwork
NodeJS + MySQL  Socket.io Server 


Running this project.
-----------------------
require npm or yarn

-Missing-

-httpvars.js: 
----
const app = require('express');
const http = require('http');


const homeURL = "http://localhost:3000";
const socketURL = "localhost:13377";
const wwwURL = "localhost:3000"

const sqlCred = "mysqlx://sqlUser:sqlPassword@localhost";
const emailUser = "emailUser";
const emailPassword = "emailPassword";
const authToken = "Any String";


const server = http.createServer(app);

exports.authToken = authToken;
exports.emailUser = emailUser;
exports.emailPassword = emailPassword;
exports.sqlCred = sqlCred;

exports.homeURL = homeURL;
exports.socketURL = socketURL;
exports.wwwURL = wwwURL;

exports.server = server;


