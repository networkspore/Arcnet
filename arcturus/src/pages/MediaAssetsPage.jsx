import React, { useState, useRef, useEffect } from 'react';
import useZust from '../hooks/useZust';

import { NavLink, useNavigate } from 'react-router-dom';
import styles from './css/home.module.css';
import produce from 'immer';
import SelectBox from './components/UI/SelectBox';
import { AddImagePage } from './AddImagePage';





export const MediaAssetsPage = () => {
    const pageSize = useZust((state) => state.pageSize)
    const user = useZust((state) => state.user)

    const [showIndex, setShowIndex] = useState(); 


    function onAddImage(e) {
       setShowIndex(2)
    }

    function onAdd3DObject(e) {
       setShowIndex(0)
    }

    function newMenuOnClick(e) {
        if(showIndex == 1)
        {
            setShowIndex(0)
        }else{
            setShowIndex(1)
        }
    }

    function addImageObject(imgObj) {

    }
    

    return (
        
       <>
<div id='MediaAssetsPage' style={{ position: "fixed", backgroundColor: "rgba(0,3,4,.95)", width: pageSize.width - 285 - 150, height: pageSize.height, left: 285 + 150, top: "0px" }}>
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
        Media
    </div>
    <div style={{ paddingLeft: "20px", display: "flex" }}>

            <div  id='AddButton' className={showIndex == 1 ? styles.toolbarActive:styles.toolbar} style={{display: "flex"}} 
            onClick={newMenuOnClick}>
            <div style={{}}>
                <img src='Images/icons/add-circle.svg' width={20} height={20} style={{ filter: "invert(100%)" }} />
            </div>
            <div style={{
                paddingLeft: "10px",
                fontFamily: "WebRockwell",
                fontSize: "15px",
                fontWeight: "bolder",
                color: "#cdd4da",
                textShadow: "2px 2px 2px #101314",
            }}>
                Add
            </div>
        </div>
        <div className={styles.toolbar} style={{ display: "flex", }}>
            <div style={{}}>
                <img src='Images/icons/enter-outline.svg' width={20} height={20} style={{ filter: "invert(100%)" }} />
            </div>
            <div style={{
                paddingLeft: "10px",
                fontFamily: "WebRockwell",
                fontSize: "15px",
                fontWeight: "bolder",
                color: "#cdd4da",
                textShadow: "2px 2px 2px #101314",
            }}>
                Load
            </div>
        </div>0
        <div style={{ width: pageSize.width - 575 }}>
            &nbsp;
        </div>
        <div className={styles.toolbar} style={{ display: "flex", backgroundColor: "rgba(80,80,80,.3)" }}>
            <div style={{}}>
                <img src='Images/icons/folder-open-outline.svg' width={20} height={20} style={{ filter: "invert(100%)" }} />
            </div>
            <div style={{
                paddingLeft: "10px",
                fontFamily: "WebRockwell",
                fontSize: "15px",
                fontWeight: "bolder",
                color: "#cdd4da",
                textShadow: "2px 2px 2px #101314",
            }}>
                Local
            </div>
        </div>
    </div>
</div>
{showIndex ==1 &&
    <div id='AddMenu' style={{ position: "fixed", top: "102px", left: "455px", width: "200px", backgroundColor:"rgba(40,40,40,.7)", }}>
        <div onClick={onAddImage} className={styles.toolmenuButton} style={{display:"flex", }}>
            <div>
                    <img src='Images/icons/image-outline.svg' width={25} height={25} style={{ filter: "invert(100%)", padding:"5px 0px" }} />
            </div>
            <div style={{padding:"10px 10px"}}>
                Image (.jpg / .png)
            </div>
        </div>
        <div onClick={onAdd3DObject} className={styles.toolmenuButton} style={{ display: "flex", }}>
            <div>
                <img src='Images/icons/prism-outline.svg' width={25} height={25} style={{ filter: "invert(100%)", padding: "5px 0px" }} />
            </div>
            <div style={{ padding: "10px 10px" }}>
                3D Object (.glb)
            </div>
        </div>
    </div>
}

{showIndex == 2 &&
    <AddImagePage 
        cancel={()=>{setShowIndex(0)}}
        result={(imgObj)=>{addImageObject(imgObj)}}
    />
}
</>
    )
        }