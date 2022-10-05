import React, { useState, useRef, useEffect } from 'react';
import useZust from '../hooks/useZust';

import { NavLink, useNavigate } from 'react-router-dom';
import styles from './css/home.module.css';
import produce from 'immer';
import SelectBox from './components/UI/SelectBox';
import { AssetsPage } from './AssetsPage';
import { ContactsPage } from './ContactsPage';




export const ProfilePage = () => {
    const pageSize = useZust((state) => state.pageSize)
    const user = useZust((state) => state.user)
    const [showIndex, setshowIndex] = useState(0)
    const nav = useNavigate();
    const setUser = useZust((state) => state.setUser)
    const setShowMenu = useZust((state) => state.setShowMenu)
    const setSocket = useZust((state) => state.setSocket)
    const setAutoLogin = useZust((state) => state.setAutoLogin)


    const onLogoutClick = (e) => {
        setAutoLogin(false);
        setUser();
        setShowMenu(false);
        setSocket(null);
    }

    return (
        
       <>
            
            <div style={{ position: "fixed", backgroundColor: "rgba(10,13,14,.6)", width: 200, height: pageSize.height, left: 85, top: "0px" }}>
                <div style={{
                    padding: "10px",
                    textAlign: "center",
                 
                }}></div>
                <div style={{ display: "flex", flexDirection: "column", alignItems:"center",  height:"150px", padding:"10px"}}>
                    <div style={{
                        borderRadius:"10px",
                        width:"100px",
                        height:"120px",
                        backgroundColor: "rgba(10,13,14,.5)"
                    }}>

                    </div>
                    <div style={{
                        paddingTop:"20px",
                        fontFamily: "WebRockwell",
                        fontSize: "15px",
                        fontWeight: "bolder",
                        color: "#cdd4da",
                        textShadow: "2px 2px 2px #101314"
                    }} >{user.userName}</div>
                    <div style={{ width: "180px",  }}>
                        <hr />
                    </div>
                </div>
               
                <div style={{ width: "170px", paddingLeft:"15px" }}>
                  

                        <div className={styles.result} style={{ display: "flex", fontSize: "15px", fontFamily: "WebPapyrus" }}
                            onClick={(e)=>{
                                setshowIndex(1)
                            }}
                            >
                           
                           <div>
                                <img style={{ filter: "invert(100%)" }} src="Images/icons/wallet-outline.svg" width={20} height={20} />
                            </div>
                            <div style={{ paddingLeft: "10px" }} >
                                Assets
                            </div>
                        </div>
                     
                    <div className={styles.result} style={{ display: "flex", fontSize: "15px", fontFamily: "WebPapyrus" }}
                        onClick={(e) =>{
                            setshowIndex(2)
                        }}
                    >

                        <div>
                            <img style={{ filter: "invert(100%)" }} src="Images/icons/wallet-outline.svg" width={20} height={20} />
                        </div>
                        <div style={{ paddingLeft: "10px" }} >
                            Assets
                        </div>
                    </div>
                    
                  
                </div>
               

            </div>
            <div style={{ position: "fixed",  width: 180, left: 95, bottom: "5px" }}>
                <nav style={{
                    width: "100%",
                    fontSize: "18px", fontFamily: "WebPapyrus"
                }}>

                    <NavLink className={styles.result} about={"Log-out"} onClick={onLogoutClick}>
                            <div style={{display:"flex"}}>
                                <div>
                                <img src="Images/logout.png" width={30} height={30} />
                                </div>
                                <div style={{paddingLeft:"10px"}}>
                                    Log-out
                                </div>
                            </div>
                    </NavLink>

                </nav>
            </div>
            {showIndex == 1 &&
                <AssetsPage />
            }
            {showIndex == 2 &&
                <ContactsPage />
            }
       </>
        
    )
}