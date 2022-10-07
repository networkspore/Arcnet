import React, { useState, useRef, useEffect } from 'react';
import useZust from '../hooks/useZust';

import { NavLink, useNavigate } from 'react-router-dom';
import styles from './css/home.module.css';
import produce from 'immer';
import SelectBox from './components/UI/SelectBox';
import { AssetsPage } from './AssetsPage';
import { ContactsPage } from './ContactsPage';
import { ProfilePage } from './ProfilePage';
import { ImageDiv } from './components/UI/ImageDiv';




export const HomePage = () => {
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
                    <ImageDiv netImage={{
                        image: "Images/icons/person.svg",
                        width: 130,
                        height: 130,
                        filter: "invert(100%)"
                    }} />
                    <div style={{ width: 200, backgroundImage: "linear-gradient(to right, #000304DD, #77777733, #000304DD)" }}>
                        <div style={{

                            textAlign: "center",
                            fontFamily: "WebRockwell",
                            fontSize: "15px",
                            fontWeight: "bolder",
                            color: "#cdd4da",
                            textShadow: "2px 2px 2px #101314",

                        }} >{user.userName}</div>

                    </div>

                    <div style={{ paddingTop: 3, height: 2, width: "100%", backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)", }}>&nbsp;</div>

                </div>
               
                <div style={{ width: "170px", paddingLeft:"15px" }}>
                    <div className={styles.result} style={{ display: "flex", fontSize: "15px", fontFamily: "WebPapyrus" }}
                        onClick={(e) => {
                            setshowIndex(1)
                        }}
                    >

                        <div>
                            <img style={{ filter: "invert(100%)" }} src="Images/icons/id-card-outline.svg" width={20} height={20} />
                        </div>
                        <div style={{ paddingLeft: "10px" }} >
                           Profile
                        </div>
                    </div>

                    <div className={styles.result} style={{ display: "flex", fontSize: "15px", fontFamily: "WebPapyrus" }}
                        onClick={(e) => {
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

                        <div className={styles.result} style={{ display: "flex", fontSize: "15px", fontFamily: "WebPapyrus" }}
                            onClick={(e)=>{
                                setshowIndex(3)
                            }}
                            >
                           
                           <div>
                                <img style={{ filter: "invert(100%)" }} src="Images/icons/people-outline.svg" width={20} height={20} />
                            </div>
                            <div style={{ paddingLeft: "10px" }} >
                                Contacts
                            </div>
                        </div>
                     
                 
                    
                  
                </div>
               

            </div>
       
            <div style={{ 
                backgroundImage: "linear-gradient(to right, #10131422, #80808011)",
                position: "fixed", 
                width:50, 
                left: 285 - 50, 
                bottom: "0px", 
                fontFamily:"Webpapyrus",
                borderTopLeftRadius: 20,
                 }}>
                

                    <NavLink to={"/"}  className={styles.menu__item} about={"Log-out"} onClick={onLogoutClick}>
                            <div style={{height:"70px",display:"flex", justifyItems:"center", alignItems:"center"}}>
                                <div>
                                <img src="Images/logout.png" width={30} height={30}  />
                                </div>
                               
                            </div>
                    </NavLink>

            </div>
            {showIndex == 1 && 
                <ProfilePage cancel={()=>{setshowIndex(0)}} />
            }
            {showIndex == 2 &&
                <AssetsPage />
            }
            {showIndex == 3 &&
                <ContactsPage />
            }
       </>
        
    )
}