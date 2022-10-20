import React, { useState, useEffect } from "react";

import { useNavigate } from 'react-router-dom';


import useZust from "../hooks/useZust";

import styles from './css/home.module.css';
import sha256 from "crypto-js/sha256";



export const RecoverPasswordPage = (props = {}) => {


    const defaultColor = "#77777750";
    const enableColor = "#FFFFFF";


    const socket = useZust((state) => state.socket)
    const setSocket = useZust((state) => state.setSocket)

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [emailCode, setEmailCode] = useState(false);
    

    const [pass, setPass] = useState("");
    const [confirm, setConfirm] = useState("")


    const navigate = useNavigate();

    const [attempts, setAttempts] = useState(0)

    useEffect(()=>{
        if(socket == null){
            navigate("/")
        }else{
            socket.off("disconnect")
            socket.on("disconnect",(value)=>{
                setSocket(null)
                navigate("/")
            })
        }   
    },[])

    function handleChange(e) {
        const { name, value } = e.target;

        if (name == "name") {
            if (value.length > 2) {
                socket.emit("checkUserName", value, (callback) => {
                    if (!callback) {
                        setName(value)
                 
                    } else {
                        setName("")
            
                    }
                })
            } else {
                setName("")
            }

        }
        if (name == "email") {

            if (/.+@.+\.[A-Za-z]+$/.test(value)) {
                socket.emit("checkEmail", value, (callback) => {
                    if (!callback) {
                        setEmail(value);
                    } else {
                        setEmail("");
                    }
                })
            } else {
                setEmail("");
            }
        }

        if (name == "emailCode") {
            if (value.length > 7) {
                setEmailCode(value)
            } else {
                setEmailCode("")
            } 
        }
        
        if (name == "pass") setPass(value);
        if (name == "confirm") setConfirm(value);
        
       
    }


    function handleSubmit(e) {
        e.preventDefault();
        setEnabled(false);
        
        if(attempts > 4)
        {
            alert("Error: Your password could not be updated.")
            navigate("/")
        }else{
            if (pass == confirm && pass != "" && confirm != "")
            {
                if (emailCode != "" && email != "" && name != "")
                {
                    var shapass = sha256(pass).toString();

                    socket.emit("updateUserPassword", { userName: name, userEmail:email, emailCode: emailCode, newPass: shapass }, (callback) => {
                        if(callback)
                        {
                            alert("Your password has been updated.")
                        }else{
                            alert("The information you have provided does not match our records.")
                            setAttempts(prev => prev++)
                        }
                    })

                }
            }
        }
        
        


    }

    return (
        <div style={{
            width: 850,
            backgroundImage: "linear-gradient(to bottom, #10131450,#00030450,#10131450)",
            position: "fixed",
            display: "flex",
            left: "50%", top: "50%", transform: "translate(-50%,-50%)",
            boxShadow: "0 0 10px #ffffff10, 0 0 20px #ffffff10, inset 0 0 30px #77777710",
            alignItems: "center", justifyContent: "center", flexDirection: "column",
            paddingTop: "50px",
        }}>
            <div style={{ height: 2, width: "100%", backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)", paddingBottom: 5, marginBottom: 5 }}>&nbsp;</div>
            <div style={{

                fontSize: "30px",
                textAlign: "center",
                fontFamily: "Webpapyrus",
                textShadow: "0 0 10px #ffffff40, 0 0 20px #ffffff60",
                fontWeight: "bolder",
                color: "#cdd4da",


            }} > Lost Password</div>
            <div style={{ height: 2, width: "100%", backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)", paddingBottom: 5, marginBottom: 5 }}>&nbsp;</div>



            <div style={{ paddingTop: '60px' }}>
                <div style={{

                    fontSize: "20px",
                    textAlign: "center",
                    fontFamily: "Webpapyrus",

                    fontWeight: "bold",
                    color: "#99999a",


                }} >Recovery Information</div>
                <div style={{ height: 5, width: "100%", backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)", }}>&nbsp;</div>

                <div>
                    <div style={{ height: 20 }}></div>
                    <div style={{
                        alignItems: "center", justifyContent: "center",
                        display: "flex",


                        backgroundImage: "linear-gradient(to right, #00030430, #77777720, #00030430)",
                        paddingBottom: 5,
                        paddingTop: 5,
                        paddingLeft: 20,
                        paddingRight: 20
                    }}>

                        <input onKeyUp={(e) => {
                            if (e.code == "Enter") {
                                handleSubmit(e)
                            }
                        }} placeholder="email@somewhere.com" style={{
                            outline: 0,
                            border: 0,
                            color: "white",
                            width: 600, textAlign: "center", fontSize: "30px", backgroundColor: "black", fontFamily: "WebPapyrus"

                        }} name="email" type="email" onChange={event => handleChange(event)} />

                    </div>
                    <div style={{ paddingTop: 30 }}>
                        <div style={{

                            display: "flex",

                            justifyContent: "center",
                            backgroundImage: "linear-gradient(to right, #00030430, #77777720, #00030430)",
                            paddingBottom: 5,
                            paddingTop: 5,
                            paddingLeft: 20,
                            paddingRight: 20
                        }}>

                            <input onKeyUp={(e) => {
                                if (e.code == "Enter") {
                                    handleSubmit(e)
                                }
                            }} name="emailCode" style={{
                                outline: 0,
                                border: 0,
                                color: "white",
                                width: 600, textAlign: "center", fontSize: "30px", backgroundColor: "black", fontFamily: "WebPapyrus"

                            }} placeholder="email code" type="input"  onChange={event => handleChange(event)} />
                        </div>

                    </div>
                    {emailCode != "" &&
                        <div>
                            <div style={{

                                display: "flex",

                                justifyContent: "center",
                                backgroundImage: "linear-gradient(to right, #00030430, #77777720, #00030430)",
                                paddingBottom: 5,
                                paddingTop: 5,
                                paddingLeft: 20,
                                paddingRight: 20
                            }}>

                                <input style={{
                                    outline: 0,
                                    border: 0,
                                    color: "white",
                                    width: 400, textAlign: "center", fontSize: "15px", backgroundColor: "black", fontFamily: "WebPapyrus"

                                }} name="pass" placeholder="Password" type="password" onChange={event => handleChange(event)} />
                                <div style={{ display: (pass.length < 8 && confirm.length > 1) ? "block" : "none" }} className={styles.disclaimer}>Password must be at least 8 characters.</div>
                            </div>
                            <div style={{ height: 30 }}></div>
                            <div style={{

                                display: "flex",

                                justifyContent: "center",
                                backgroundImage: "linear-gradient(to right, #00030430, #77777720, #00030430)",
                                paddingBottom: 5,
                                paddingTop: 5,
                                paddingLeft: 20,
                                paddingRight: 20
                            }}>
                                <input name="confirm" style={{
                                    outline: 0,
                                    border: 0,
                                    color: "white",
                                    width: 400, textAlign: "center", fontSize: "15px", backgroundColor: "black", fontFamily: "WebPapyrus"

                                }} placeholder="Re-enter password" type="password" onChange={event => handleChange(event)} />
                                <div style={{ display: ((confirm.length > 7) && (confirm != pass)) ? "block" : "none" }} className={styles.disclaimer}>Passwords must match</div>
                            </div>
                        </div>
                    }
                    
                </div>
                <div style={{ display: "flex", paddingTop: "20px", marginBottom: 30, alignItems: "center", justifyContent: "center", }} >

                    <div style={{
                        textAlign: "center",
                        cursor: "pointer",
                        fontFamily: "WebPapyrus",
                        fontSize: "18px",
                        fontWeight: "bolder",
                        width: 100,

                        paddingLeft: "0px",
                        paddingTop: "10px",
                        paddingBottom: "10px",

                    }}
                        className={styles.CancelButton}
                        onClick={(e) => { navigate("/") }} >
                        Cancel
                    </div>

                    {emailCode != ""}
                    <div>
                    <div style={{

                        marginLeft: "10px", marginRight: "10px",
                        height: "80px",
                        width: "1px",
                        backgroundImage: "linear-gradient(to bottom, #000304DD, #77777755, #000304DD)",
                    }}></div>
                    <div onClick={handleSubmit} style={{
                        textAlign: "center",
                        cursor: (name.length > 2 && pass.length > 7 && confirm == pass && refID > 0) ? "pointer" : "default",
                        fontFamily: "WebPapyrus",
                        fontSize: "18px",
                        fontWeight: "bolder",
                        width: 100,
                        color: (name.length > 2 && pass.length > 7 && confirm == pass && refID > 0) ? enableColor : defaultColor,
                        paddingLeft: "0px",
                        paddingTop: "10px",
                        paddingBottom: "10px",
                    }}
                        class={(name.length > 2 && pass.length > 7 && confirm == pass && refID > 0) ? styles.OKButton : ""}

                    > Confirm </div>

                    </div>

                </div>




            </div>

        </div>

    )
}

// setSocket(io(socketIOhttp, { auth: { token: socketToken, user: { nameEmail: 'annonymous' } }, transports: ['websocket'] }))