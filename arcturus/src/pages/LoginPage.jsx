import React, { useEffect, useState } from "react";
import styles from './css/login.module.css';
import { useNavigate} from 'react-router-dom';
import { useCookies } from "react-cookie";
import sha256 from 'crypto-js/sha256';
import useZust from "../hooks/useZust";
import produce from "immer";
import { io } from "socket.io-client";
import { socketIOhttp, socketToken } from '../constants/httpVars';
import { useRef } from "react";
import { get } from "idb-keyval";

 const LoginPage = (props = {}) =>  {

    const txtName = useRef();
    const txtPass = useRef();

    const setSocket = useZust((state) => state.setSocket)
    const setUser = useZust((state) => state.setUser)
    const setContacts = useZust((state) => state.setContacts)
    const setContactRequests = (value) => useZust.setState(produce((state)=>{
        state.contactRequests = value;
    }))

    const [data, setData] = useState({ loginRemember: false, loginName: "", loginPass: "" });
    const [cookie, setCookie] = useCookies(['login']);
   

    const navigate = useNavigate(); 
    
    const [disable, setDisable] = useState(false)
    const autoLogin = useZust((state) => state.autoLogin)
 
    const setShowMenu = useZust((state) => state.setShowMenu)
    
   // const [overlayPos, setOverlayPos] = useState({top:200, left:200})
   // const overlaySize = {width: 600, height: 400};

    const pageSize = useZust((state) => state.pageSize);
   // const scrollLeft = useZust((state) => state.scrollLeft)
   // const scrollTop = useZust((state) => state.scrollTop)

    const setLoginPage = useZust((state) => state.setLoginPage);
    const setCampaigns = useZust((state) => state.setCampaigns);

    const onLoginRemember = e =>{
        setData(prevState => ({
            ...prevState,
            ["loginRemember"]: !prevState.loginRemember
        }));

    }

    const handleChange = e => {
        const { name, value } = e.target;
        setData(prevState => ({
            ...prevState,
            [name]: value
        }));

    }
    

    useEffect(()=>{
      
        let isLogin = false;
    
        if(autoLogin){
            if ("login" in cookie){
                if(cookie.login.useCookie)
                {
                    
                    isLogin = login(cookie.login.name, cookie.login.pass);
            
                }
            }
        }else{
            if ("login" in cookie) {
                if (cookie.login.useCookie) {
                    setCookie("login", { useCookie: false, name: "", pass: "" })
                    
                   
                }
            }
        }
        if(!isLogin){
            setLoginPage();
        }
         //   setFillMainOverlay(false);

        
       // setOverlayPos(produce((state) => {
         //  state.top = pageSize.height/2 - 200;
         //  state.left =  pageSize.width * .25 - 300;
       // }))

        return () => {
     
        }
    }
    ,[]);


    function handleCreate(event) {

        if (!disable) {
            setDisable(true);
            setSocket(io(socketIOhttp, { auth: { token: socketToken, user: { nameEmail: 'anonymous' } }, transports: ['websocket'] }))
            navigate("/welcome")
        }
        
        
    }

    function handleSubmit(e) {
        e.preventDefault();
        let pass = sha256(data.loginPass).toString();
        login(data.loginName, pass);
    }
    const setLocalDirectory = (value) => useZust.setState(produce((state)=>{
        state.localDirectory = value;
    }))
    const setFiles = (value) => useZust.setState(produce((state)=>{
        state.files = value;
    }))
    function login(name_email = "", pass ="")
    {
        if(!disable){
            setDisable(true);
            const sock = io(socketIOhttp, { auth: { token: socketToken, user: { nameEmail: name_email, password: pass } }, transports: ['websocket'] });
            
            sock.on("loggedIn", (user, contacts, requests) =>{
                sock.off("loggedIn")
                if(data.loginRemember){
               
                    setCookie("login", { useCookie: true, name: name_email, pass: pass })
                }
                setUser(user)
                setContacts(contacts)
                setContactRequests(requests)
                setSocket(sock);
                setShowMenu(true);

                var dir = get("localDirectory" + user.userID)

                dir.then((value) => {

                    const name = value.name;

                    setLocalDirectory(name)
                    const idbFiles = get(name);
                    
                    idbFiles.then((res) => {
                        setFiles(res);
                    }).catch((error => {
                        console.log(error)
                    }))


                })
                
                return true;
            })
            sock.on("failedLogin", () =>{
                setDisable(false)
                alert("Please check your credentials and try again.")
                return false
            })
        }
    }


return (
    <div style={{
        display: "block",

        left: "25%",
        width: 650, height: 400, 
        top: "50%",
        position: "fixed",
        transform:"translate(-50%,-50%)",
        
    }}
    >

       

    <div style={{ padding:"30px", boxShadow: "2px 2px 5px #101010", backgroundColor: "rgba(16,19,20,.3)", textShadow: "2px 2px 2px black",  textAlign:"center", position:"absolute", zIndex:2}}>
        <div style={{ cursor: "default", paddingTop: 30, paddingBottom: 20, fontWeight: "bold", fontSize: "50px", fontFamily: "WebRockwell", color:"#cdd4da" }}>
                Log In
            </div>
            <form onSubmit={event => handleSubmit(event)}>
                <div className={styles.paddingTopTen}>
                    <input ref={txtName} name="loginName" className={styles.loginTxt} placeholder="Name or Email" type="text" onChange={handleChange} />
                </div>

                <div style={{ paddingTop:20 }}>
                    <input ref={txtPass} name="loginPass" className={styles.loginTxt} placeholder="Password" type="password" onChange={handleChange} />
                </div>
                <div name="loginRemember" className={styles.checkPos} >
                    <div className={data.loginRemember ? styles.checked : styles.check} name="loginRemember" onClick={onLoginRemember} />
                    <div onClick={onLoginRemember} style={
                        {
                        cursor: "pointer", color: (data.loginRemember) ? "#D6BD00" : "#776a05"
                        }} className={styles.keep}>Keep me signed in.</div>
                </div>
                <div className={styles.submitPos}>
                    <input className={
                            (data.loginName.length > 2 && data.loginPass.length > 7) ? styles.loginEnable : styles.loginDisable
                        }
                        type="submit" value="Log In"
                        disabled={
                            (data.loginName.length > 2 && data.loginPass.length > 7) || (disable) ? false : true
                        } />
                </div>

                <div className={styles.paddingTop20}>
                    <a onClick={handleCreate} className={styles.createLink}>Create Account</a>
                </div>

            </form>
        </div>
        </div>
       
    )
    
    

};

export default LoginPage;