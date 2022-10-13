import React, { useState, useRef, useEffect } from 'react';
import useZust from '../hooks/useZust';
import styles from './css/home.module.css';

import { AddImagePage } from './AddImagePage';


import { get, set } from 'idb-keyval';
import produce from 'immer';



export const LocalAssetsPage = () => {
    const pageSize = useZust((state) => state.pageSize)
    const user = useZust((state) => state.user)

    const localDirectory = useZust((state) => state.localDirectory)
    const setLocalDirectory = (value) => useZust.setState(produce((state) => {
        state.localDirectory = value;
    }));
    const [showIndex, setShowIndex] = useState(); 
    const [keys, setKeys] = useState([])

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

    useEffect(()=>{
        console.log(localDirectory)
    },[localDirectory])


    async function pickAssetDirectory() {
        const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        
        await handleFirst(dirHandle)
    }

   

 

    async function handleFirst (dirHandle) {
        
        const name = await dirHandle.name;
        console.log(name)
        setLocalDirectory(name)
        set("Local DIrectory", dirHandle)
        
        await handleDirectoryEntry(dirHandle)
    }


    async function handleDirectoryEntry (dirHandle) {
        
        for await (const entry of dirHandle.values()) {
            if (entry.kind === "file") {
                const file = await entry.getFile();
                set(file.name, file)
                setKeys(produce((state)=>{
                    state.push(file.name)
                }))
               // out[file.name] = file;
            }
            if (entry.kind === "directory") {
                //const newOut = out[entry.name] = {};
                await handleDirectoryEntry(entry);
            }
        }
        
    }



    return (
        
       <>
  <div id='AssetsPage' style={{
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
                Local Assets: {localDirectory}
            </div>
                <div style={{ paddingLeft: "20px", display: "flex" }}>

                    <div id='AddButton' className={showIndex == 1 ? styles.toolbarActive : styles.toolbar} style={{ display: "flex" }}
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
                    <div onClick={(e)=>{pickAssetDirectory()}} className={styles.toolbar} style={{ display: "flex", }}>
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
                    </div>
                  
                </div>
            <div style={{ paddingLeft: "15px", display: "flex", height: "430px" }}>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "150px", width: 200, padding: "10px" }}>
                   

                 

             
                </div>
                <div style={{ width: 2, height: "100%", backgroundImage: "linear-gradient(to bottom, #000304DD, #77777733, #000304DD)", }}>&nbsp;</div>
                <div style={{ display: "flex", 
                
                flexDirection: "column", 
                justifyContent: "center", 
                width: "500px", 
                backgroundColor: "#33333322",
                overflowY:"scroll",
                
                 }}
                >
                    {keys}
                    
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

        /*
        
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
    </div>*/