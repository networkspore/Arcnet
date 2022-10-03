import React, { useState, useRef, useEffect } from 'react';
import useZust from '../hooks/useZust';

import { NavLink, useNavigate } from 'react-router-dom';
import styles from './css/home.module.css';
import produce from 'immer';
import SelectBox from './components/UI/SelectBox';
import { MediaAssetsPage } from './MediaAssetsPage';





export const AssetsPage = () => {
    const pageSize = useZust((state) => state.pageSize)
    const user = useZust((state) => state.user)
  
    const [currentAssetsPage, setCurrentAssetsPage] = useState(0);
    const nav = useNavigate();

    function onMediaAssetsClick(e) {
        setCurrentAssetsPage(1);
    }

    function homeOnClick(e) {
        setCurrentAssetsPage(0);
    }

    

    return (
        
       <>
            <div style={{ position: "fixed", backgroundColor: "rgba(0,3,4,.7)", width: 170, height: pageSize.height, left: 285, top: "0px" }}>
                <div style={{
                    padding: "10px",

                    width: "150px",
                    paddingTop: "20px",
                    backgroundImage: "linear-gradient(black, #030507AA)"

                }}>
                    &nbsp;
                </div>
                <div style={{ height:"55px", backgroundColor:"rgba(0,3,4,.95)"}}>

                </div>
                <div style={{height:"100%", width:"150px", border:"solid 10px #000304"}}>
                    <div className={styles.darkMenu} style={{ display: "flex", fontSize: "15px", color: currentAssetsPage == 1 ? "white" : "#777171", fontFamily: "WebPapyrus", backgroundColor: currentAssetsPage == 1 ? "rgba(0,3,4,.95)" : "rgba(0,3,4,0)" }}
                        onClick={onMediaAssetsClick}
                    >

                        <div>
                            <img style={{ filter: "invert(100%)" }} src="Images/icons/file-tray-stacked-outline.svg" width={20} height={20} />
                        </div>
                        <div style={{ paddingLeft: "10px" }} >
                           Media
                        </div>
                    </div>

                </div>
            </div>  
            {currentAssetsPage == 1 &&
                <MediaAssetsPage />
            }
        </>
    )
}