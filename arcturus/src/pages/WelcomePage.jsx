import React, { useState, useEffect, useRef  } from "react";

import { useNavigate } from 'react-router-dom';

import useZust from "../hooks/useZust";

import styles from './css/welcome.module.css';
import NewUserPage from './NewUserPage'


const WelcomePage = () => {
    
 
    const defaultColor = "#79680d";
    const enableColor = "#ffe51c";

    const navigate = useNavigate();

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
            if (value.length > 9) {
                socket.emit("checkRefCode", value, (callback)=>{
                    if(callback > 0)
                    {
                        setValid(prev => true);
                        setRefID(callback);
                    }
                });
            }else{
                if(valid)setValid(prev => false);
            }
        }
    }

    function handleSubmit1(e) {
        e.preventDefault();
        
        if(valid)setCurrent(2)
    }
    

    useEffect(()=>{
        setWelcomePage();
      
        setCurrent(1);
     
    },[])

    const createUser = (newUser) =>{

        socket.emit('createUser', newUser, (response) => {
            if (!("LoggedIn" in response)) {
                if ("msg" in response) {
                    alert(response.msg);
                } else {
                    alert("Cannot confirm user.");
                }

                navigate("/welcome")
            } else {
                if (response.LoggedIn == true) {
            
                    setRedirect({ loadPage: "/home", evt: "", msg: "Redirecting" });
                    setUser(response)

                } else {
                    if ("msg" in response) {
                        alert(response.msg);

                    } else {
                        alert("Cannot confirm user.");

                    }
                    navigate("/welcome")
                }

            }

        });
    }
   

    return (
        <>
        { current == 1 &&
        
        <div style={{ width: 850, height: 920, position:"fixed",  left:"50%", top:"50%", transform:"translate(-50%,-50%)" }}>

       
            <div style={{ width: 850, height: 920, boxShadow: "2px 2px 5px #101010", backgroundColor: "rgba(16,19,20,.3)", textAlign: "center", position: "absolute", zIndex: 2 }}>

       
                    <br /><br />
               
                    <div className={styles.heading}>IN A LAND FAR AWAY...</div>

                    <div style={{ paddingTop: '50px' }} class={styles.p2}>Rumors spread of a light flickering in the shadows...</div>

                    <div style={{paddingTop: "80px"}}>
                       
                        <img src="Images/down.png" />
                        <form onSubmit={event => handleSubmit1(event)}>

                    <div style={{ paddingTop: "70px" }}>


                        <input name="ref"  class={styles.blkInput} placeholder="Referral code" type="input" autoFocus onChange={event => handleChange(event)} />


                    </div>

                            <div style={{paddingTop: "70px"}}>


                                <input name="email" class={styles.blkLargeInput} placeholder="Enter email here" type="email" onChange={event => handleChange(event)} />


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
                                This is a private server not intended for public use.
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
