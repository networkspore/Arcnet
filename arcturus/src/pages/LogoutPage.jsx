import produce from "immer";
import React, { useState, useEffect, useRef } from "react";

import { useNavigate } from 'react-router-dom';
import useZust from "../hooks/useZust";
import CampUsers from "./components/UI/campUsers";




import styles from './css/campaign.module.css';




const LogoutPage = () => {
    const navigate = useNavigate();
    const setPage = useZust((state) => state.setPage)
    const user = useZust((state)=> state.user)
    //  const setFillMainOverlay = useZust((state) => state.setFillMainOverlay);

    const scrollLeft = useZust((state) => state.scrollLeft);
    const scrollTop = useZust((state) => state.scrollTop);

    const [overlayPos, setOverlayPos] = useState({left:300, top: 300})

    const pageSize = useZust((state) => state.pageSize);
   
    const setUser = useZust((state) => state.setUser)




    useEffect(()=>{
        setPage(0);
        
       setUser({LoggedIn:false,userID:0,userName:"",userEmail:"",userSuper:false})
     
    },[])

 
    const handleSubmit = (e) => {
        e.preventDefault();
        navigate("/login")
    }

    return (
        <div style={{
         

            left: "50%",

            top: "75%",
            position: "fixed",
            margin: "auto auto",
            width: 100, height: 220,
            transform:"translate(-50%,-50%)",
            display: "flex", justifyContent: "center", alignItems: "center"
        }}
        >

          
     
            <div style={{ justifyContent: "center",flex:1}}>
                <div style={{display:"flex", justifyContent: "center",cursor:"default"}} className={styles.whiteTitle}>Arcturus</div>
            <form onSubmit={event => handleSubmit(event)}>
                    <div style={{ paddingTop: "20px" }}><input autoFocus  className={styles.blkInputSubmit}  type="submit" value="ENTER" /></div>
            </form>
            </div>
     
      
            </div>
    )
}

export default LogoutPage;