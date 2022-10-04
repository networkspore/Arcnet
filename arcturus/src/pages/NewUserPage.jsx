import React, { useState, useEffect } from "react";

import { useNavigate } from 'react-router-dom';


import useZust from "../hooks/useZust";

import styles from './css/welcome.module.css';
import sha256 from "crypto-js/sha256";



const NewUserPage = (props = {}) => {
  

    const defaultColor = "#79680d";
    const enableColor = "#ffe51c";
    
    const newEmail = props.newEmail;
    const refID = props.refCode;

    const callback = props.createUser;

    const socket = props.socket;

    const [name, setName] = useState("");
    const [confirm, setConfirm] = useState(false);
    const [pass, setPass] = useState("");


    const [enabled, setEnabled] = React.useState(true);
  


    const [nameAvailable, setNameAvailable] = useState(true);




    function handleChange(e) {
        const { name, value } = e.target;

        if (name == "name") {
            if (value.length > 2) {
                socket.emit("checkUserName", value, (callback) => {
                    if (callback) {
                        setName(value)
                        setNameAvailable(pre => true);
                    } else {
                        setName("")
                        setNameAvailable(pre => false);
                    }
                })
            } else {
                setName("")
            }
           
        } 
        if (name == "pass") setPass(prev =>value);
        if (name == "confirm") setConfirm(prev =>value);

    }

    useEffect(() => {
        if(newEmail.length < 6){
            navigate("/welcome");
        } 

       
    }, [])

    function handleSubmit2(e) {
        e.preventDefault();
        setEnabled(false);
        var shapass = sha256(pass).toString();

        callback({ userName: name, userPass: shapass, userEmail: newEmail })
        

        
    }

return (
    <div style={{ width: 850, height: 920,  position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>

        <div style={{ width: 850, height: 920,  boxShadow: "2px 2px 5px #101010", backgroundColor: "rgba(16,19,20,.3)",  textAlign: "center", position: "absolute", zIndex: 2 }}>
    
            <br /><br />
            <div className={styles.heading}> FROM THE SHADOWS... </div>
            <div style={{ position: "initial", textAlign: "center"}}>
              
        <div style={{ paddingTop: '40px' }} class={styles.p3}>How will you be known?</div>
        <div style={{ paddingTop: '60px' }}><img src="Images/down.png" /></div>
        <div style={{ paddingTop: '60px' }}>
            <form onSubmit={event => handleSubmit2(event)}>
                <div>
                    <input name="name" class={styles.blkInput} placeholder="Enter user name" autoFocus onChange={event => handleChange(event)} />
                    <div style={{display:nameAvailable ? "none" : "block"}} className={styles.disclaimer}>Name not available</div>
                </div>
                <div style={{ paddingTop: '60px' }}>

                    <input name="pass" class={styles.blkPassInput} placeholder="Enter password" type="password" onChange={event => handleChange(event)} />
                        <div style={{ display: (pass.length < 8 && confirm.length > 1) ? "block" : "none"  }} className={styles.disclaimer}>Password must be at least 8 characters.</div>
                </div>

                <div style={{ paddingTop: '30px' }}>
                    <input name="confirm" class={styles.blkPassInput} placeholder="Re-enter password" type="password" onChange={event => handleChange(event)} />
                        <div style={{ display: ((confirm.length > 7) && (confirm != pass)) ? "block" : "none"  }} className={styles.disclaimer}>Passwords must match</div>
                </div>

                <div style={{ paddingTop: '70px' }}>
                    <input style={
                        {
                            color: (name.length > 2 && pass.length > 7 && confirm == pass && refID > 0) ? enableColor : defaultColor
                        }}
                        class={styles.blkSubmit} type="submit" value="CONFIRM"
                        disabled={
                            (enabled && name.length > 2 && pass.length > 7 && confirm == pass && refID > 0) ? false : true
                        } />
                    <div class={styles.disclaimer} style={{ paddingTop: '60px' }}>
                       This is a private server.
                    </div>
                </div>
            </form>

        </div>

    </div>
    </div>
    </div>
)
}

export default NewUserPage;