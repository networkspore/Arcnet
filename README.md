# ArcturusNetwork
NodeJS + MySQL socket server with a p2p network on top for Game Master game creation.

The front end utilizes a vite (webpack) react server and WebGL graphics.


Running this project.
-----------------------
If you clone the repo you'll find get both the back and front end servers and find files missing.

-Missing-
App.js
-httpvars.js: contains username and password connection stuff for the mysql server, and domain variables for CORS. 

LoginPage.jsx (arcturus/src/pages/LoginPage.jsx)
-httpvars.jsx: contains socket information (URL:port). (must be entered in CORS on the server)

-Campaign (MySQL) -> Realm (P2P)-
the campaign used to utilize the socket to communicate with app.js and mysql.


-Notes-
New Realm will utilize P2P and chrome's File System Acess (with async/await) - not supported in firefox

-Routing- (index.jsx -> HomeMenu.jsx)

HomeMenu handles routing based on the browser location, rather than using the built in 'Routes'.

Browser location can now be parsed allowing for more control.

App.js
-Contains many database functions for use in the campaign, these will eventually be pruned.
