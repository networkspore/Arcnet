import React, { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";

import useZust from "../hooks/useZust";
import { ImageDiv } from "./components/UI/ImageDiv";

export const ProfilePage = (props = {}) =>{
    
        const pageSize = useZust((state) => state.pageSize)
        const user = useZust((state) => state.user)
        const socket = useZust((state) => state.socket)

        const [profileInfo, setProfileInfo] = useState(null);
        const nav = useNavigate();
    
        useEffect(() => {
            socket.emit("getProfileInfo", (info)=>{
                setProfileInfo()
            })
        }, [])



        return (

            <>
                <div id='Profile' style={{ 
                    position: "fixed", 
                    backgroundColor: "rgba(0,3,4,.95)", 
                    width: 800, 
                    height: 600, 
                    left: (pageSize.width/2) - 400, 
                    top: (pageSize.height/2) - 300
                    
                    }}>
                    <div style={{
                        
                        textAlign: "center",
                        width: "100%",
                        paddingTop: "20px",
                        fontFamily: "WebRockwell",
                        fontSize: "18px",
                        fontWeight: "bolder",
                        color: "#cdd4da",
                        textShadow: "2px 2px 2px #101314",
                        backgroundImage: "linear-gradient(black, #030507AA)"

                    }}>
                        Profile
                    </div>
                    <div style={{ paddingLeft: "20px", display: "flex" }}>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "150px", padding: "10px" }}>
                            <ImageDiv netImage={{
                                image: "Images/icons/person.svg",
                                width: 130,
                                height: 130,
                                filter: "invert(100%)"
                            }} />
                            <div style={{
                                paddingTop: "20px",
                                fontFamily: "WebRockwell",
                                fontSize: "15px",
                                fontWeight: "bolder",
                                color: "#cdd4da",
                                textShadow: "2px 2px 2px #101314"
                            }} >{user.userName}</div>
                            <div style={{ width: "180px", }}>
                                <hr />
                            </div>
                        </div>
                        
                    </div>
                </div>


            </>
        )
}

 
