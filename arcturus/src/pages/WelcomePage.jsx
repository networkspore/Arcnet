import React, { useState, useEffect, useRef  } from "react";

import { useNavigate } from 'react-router-dom';

import useZust from "../hooks/useZust";

import styles from './css/welcome.module.css';
import NewUserPage from './NewUserPage'
import { io } from "socket.io-client";
import { socketIOhttp, socketToken } from '../constants/httpVars';

const WelcomePage = () => {
    
 
    const defaultColor = "#79680d";
    const enableColor = "#ffe51c";

    const navigate = useNavigate();

    const setSocket = useZust((state) => state.setSocket)
    const socket = useZust((state) => state.socket);
    const user = useZust((state) => state.user);
    const setUser = useZust((state) => state.setUser);

    const setRedirect = useZust((state) => state.setLoading);
    const redirect = useZust((state) => state.loading);


    const setWelcomePage = useZust((state) => state.setWelcomePage);
    const [newEmail, setEmail] = useState(""); 


    const [current, setCurrent] = useState(0);

    
    
   const [refID, setRefID] = useState("");

    const [valid, setValid] = useState(false);

    const [showpage, setShowpage] = useState(false)
    

    useEffect(() => {
        setWelcomePage();

        setCurrent(1);
        return () => {
            setSocket(null)
        }
    }, [])

    useEffect(() => {
        if (socket == null) {
            navigate("/")
        }
    },[socket])


    function handleChange(e) {
        const { name, value } = e.target;
        
  
        if(name == "email") {
           
            if (/.+@.+\.[A-Za-z]+$/.test(value))
           {
               socket.emit("checkEmail", value, (callback)=> {
                   if(callback)
                   {
                        setEmail(value);
                   }else{
                       setEmail("");
                   }
               })
            }else{
                setEmail("");
            }
        }

        if(name == "ref"){
            if (value.length > 7) {
                socket.emit("checkRefCode", value, (callback)=>{
                    if(callback > 0)
                    {
                        setValid(prev => true);
                        setRefID(callback);
                    }else{
                        if (valid) setValid(prev => false);
                    }
                });
            }else{
               
                if(valid)setValid(prev => false);
            }
        }
    }

    function handleSubmit(e) {
        e.preventDefault();
        
        if(valid)setCurrent(2)


    }
    

 

    const createUser = (newUser) =>{
        newUser.userRefID = refID;
        socket.emit('createUser', newUser, (response) => {
            if (!response.create) {
                alert(response.msg);
                navigate("/welcome")
            } else {
                alert("User created, Please log in.")
                navigate('/')
            }

        });
    }
   

    return (
        <>
        { current == 1 &&
        
        <div style={{ width: 850, height: 700, position:"fixed",  left:"50%", top:"50%", transform:"translate(-50%,-50%)" }}>

       
            <div style={{ width: 850, height: 700, boxShadow: "2px 2px 5px #101010", backgroundColor: "rgba(16,19,20,.3)", textAlign: "center", position: "absolute", zIndex: 2 }}>

       
                    <br /><br />
               
                    <div className={styles.heading}>Welcome!</div>

                   

                    <div style={{paddingTop: "50px"}}>
                       
                        <img src="Images/down.png" />
                        <form onSubmit={handleSubmit}>

                    <div style={{ paddingTop: "70px" }}>


                        <input name="ref"  class={styles.blkInput} placeholder="Referral code" type="input" autoFocus onChange={event => handleChange(event)} />


                    </div>
                    <div style={{ paddingTop: "5px", color:"#777171"}} >
                        {valid ?  "Code valid." : "Enter a valid referral code."}
                    </div>
                            <div style={{paddingTop: "40px"}}>


                                <input name="email" class={styles.blkLargeInput} placeholder="Enter email here" type="email" onChange={event => handleChange(event)} />


                            </div>
                                <div style={{ paddingTop: "5px", color: "#777171" }} >
                                    {newEmail == "" ? "Enter an unused email." : "Email valid."}
                                </div>
                            <div class={styles.paddingTop90}>
                                <input style={
                                    {
                                        color: ((newEmail.length > 4)&&(valid)) ? enableColor : defaultColor
                                    }}
                                    class={styles.blkSubmit} type="submit" value="CONFIRM"
                                    disabled={
                                        (newEmail.length > 4) && (valid) ? false : true
                                    }
                                />
                            </div>

                    <div style={{ paddingTop:"100px"}} class={styles.disclaimer} >
                                <br></br>
                                &nbsp;
                            </div>
                        </form>
                    </div>
            </div>
        </div>
        }
        {current ==2 &&
            <NewUserPage socket={socket} newEmail={newEmail} refCode={refID} createUser={(newUser)=>createUser(newUser)}/>
        }
        </>     
    )
}

export default WelcomePage;
