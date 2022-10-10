# ArcturusNetwork
NodeJS + MySQL socket server with a p2p network on top for Game Master game creation.

The front end utilizes a vite (webpack) react server and WebGL graphics.


Running this project.
-----------------------
If you clone the repo you'll find get both the back and front end servers and find that there's plenty of stuff missing and sections that don't work.

The first thing you'll be missing is httpvars from app.js, which is the file that contains all of the username and password connection stuff for the mysql server, and such. You'll have to put your own connection string in. 

App.js needs plenty of revision.

The next thing you'll notice is that there's a nested project in the Arcturus directory, which contains the react app front-end. 

This project has a similar httpvars file, that contains connection information for the socket.io client, which is also missing.

You'll also be missing the images directory.

The backend database is currently being renovated, along with the gamecreation. I am migrating from having assets stored on the server to trying to store them on the client, and have them shared P2P rather than via http. 
