import React, { useState, useEffect } from "react";



import useZust from "../hooks/useZust";
import { ImageDiv } from "./components/UI/ImageDiv";

import styles from './css/home.module.css'

export const CreateReferalCode = (props = {}) => {


    const pageSize = useZust((state) => state.pageSize)
    const user = useZust((state) => state.user)
    const socket = useZust((state) => state.socket)

    function onCancelClick(e) {
        props.cancel();
    }

    function onOKclick(e) {

    }

    function onBackClick(e) {
    
        props.back()
    }


    
    return (
        <div id='CreateReferalCode' style={{
            position: "fixed",
            backgroundColor: "rgba(0,3,4,.95)",
            width: 800,
            height: 500,
            left: (pageSize.width / 2) - 400,
            top: (pageSize.height / 2) - 250

        }}>
            <div style={{
                marginBottom: "5px",
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
                Referal Codes
            </div>
            <div style={{ paddingLeft: "15px", display: "flex", height: "430px" }}>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "150px", width: 200, padding: "10px" }}>
                    <div style={{ cursor: "pointer" }} >
                        <ImageDiv netImage={{
                            image: "Images/icons/person.svg",
                            width: 130,
                            height: 130,
                            filter: "invert(100%)"
                        }} />
                    </div>
                    <div style={{ width: 200, backgroundImage: "linear-gradient(to right, #00030400, #77777777, #00030400)" }}>
                        <div style={{

                            textAlign: "center",
                            fontFamily: "WebRockwell",
                            fontSize: "15px",
                            fontWeight: "bolder",
                            color: "#cdd4da",
                            textShadow: "2px 2px 2px #101314",

                        }} >{user.userName}</div>

                    </div>

                    <div style={{ paddingTop: 3, height: 2, width: "100%", backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)", }}>&nbsp;</div>

             
                </div>
                <div style={{ width: 2, height: "100%", backgroundImage: "linear-gradient(to bottom, #000304DD, #77777733, #000304DD)", }}>&nbsp;</div>
                <div style={{ display: "flex", 
                
                flexDirection: "column", 
                justifyContent: "center", 
                width: "500px", 
                backgroundColor: "#33333322" }}
                >
                    <div style={{
                        width: "300px",
                        fontFamily: "Webrockwell",
                        color: "#cdd4da",
                        fontSize: "18px",
                    }}>
                        <div style={{ display: "flex", paddingTop: "50px", marginLeft:"10px" }} >
                            <div style={{ paddingLeft:10, paddingRight:10 }} className={styles.CancelButton} > Generate </div>
                            <div> <input 
                                placeholder="Enter a code..." 
                                autoFocus 
                                type={"text"}
                                style={{
                                    width:270,
                                    height: "38px",
                                    textAlign: "center",
                                    border: "0px",
                                    color: "white",
                                    backgroundColor: "black",
                                   
                                }} /> </div>
                            <div style={{ paddingLeft: 30, paddingRight: 30 }} className={styles.CancelButton} > OK </div>
                        </div>
                     
                    </div>
                    <div style={{marginLeft: "20px", marginTop:"30px"}}>
                    <div style={{
                        backgroundColor:"#00000050",
                        width:"450px",
                        height:200
                    }}>

                    </div>
                    </div>
                    <div style={{
                        justifyContent: "center",
                        width: "500px",
                        paddingTop: "30px",
                        display: "flex",
                        alignItems: "center"
                    }}>

                        <div style={{paddingLeft:"10px", paddingRight:"10px"}} className={styles.OKButton} onClick={onBackClick} >Back</div>

                    </div>
                </div>

            </div>
        </div>
    )
}