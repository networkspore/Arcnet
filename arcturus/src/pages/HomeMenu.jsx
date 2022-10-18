import useZust from "../hooks/useZust";
import React, { useEffect, useState } from "react";
import styles from './css/ContentMenu.module.css';
import { NavLink, useNavigate } from "react-router-dom";
import { ErgoDappConnector } from "ergo-dapp-connector";





const HomeMenu = ({ props}) => {
   
    const goToEditor = useZust((state) => state.torilActive);
    const setTorilActive =useZust((state) => state.setTorilActive);
    const showMenu = useZust((state => state.showMenu))
 
    const navigate = useNavigate();
    const pageSize = useZust((state) => state.pageSize);

    const user = useZust((state) => state.user);
    const socket = useZust((state) => state.socket);

    const campaigns = useZust((state) => state.campaigns)
    const [camps, setCamps] = useState([]);
    const toNav = useNavigate()
    const currentCampaign = useZust((state) => state.currentCampaign)





    useEffect(() => {
       
        setCamps(prev => []);
        campaigns.forEach((camp, i) => {
     
                    setCamps(prev => [...prev,(
                        <NavLink onClick={(e)=>{
                            
                            if (currentCampaign == camp[0]){ e.preventDefault();}else{
                                
                            }
                            
                        }} key={i} className={currentCampaign == camp[0] ? styles.menuActive : styles.menu__item} about={camp[1]} state={{ campaignID: camp[0], campaignName: camp[1], roomID: camp[3], adminID: camp[4] }} to={"/realm"}>
                            <div style={{width:"50px", height:"50px", borderRadius: "10px", overflow: "hidden" }}><img src={camp[2]} width={50} height={50} /></div>
                        </NavLink>
                    )])
         
        });
       
    },[campaigns,currentCampaign])






    /*     <NavLink className={(navData) => navData.isActive ? styles.menuActive : styles.menu__item} about="D&D" to={'/campaign'}>
                        <img src="Images/Campaign/1/logo.png" width={50} height={50} />
                    </NavLink>
                    */
    
   

    function onProfileClick(e){
        if(user.userID > 0){
            toNav("/profile")
        }
    }

    return (
        <>
            <div style={{ 
                position: "fixed", top: 0, right: 0, height: 30, 
                backgroundImage: "linear-gradient(to bottom, #00000088,#10131488)" }}>
                <div style={{display:"flex"}}>
                    
                    <div style={{paddingTop:"6px",display:"flex",cursor:"pointer", backgroundColor:"black"}} >
                        <div onClick={(e) =>{
                            if (user.userID > 0) {
                                toNav("/search")
                            }
                        }}>
                        <img src={user.userID > 0 ? "Images/logo.png" : "Images/logout.png"} width={30} height={30} />
                        </div>
                        <div onClick={onProfileClick} style={{ 
                            fontFamily: "WebPapyrus", 
                            color:"#c7cfda",
                            fontSize:"16px",
                            paddingTop:"5px",
                            paddingLeft:"10px",
                            paddingRight:"10px"
                        }}> {user.userID > 0 ? user.userName : "Offline"}</div>
                    </div>
                    <div>
                    <ErgoDappConnector color="black" />
                    </div>
                </div>
            </div>

            
        {(user.userID > 0 && showMenu) &&
                <div style={{ position: "fixed", top: 0, left: 0, height: pageSize.height, width: 85, backgroundImage: "linear-gradient(to bottom, #00000088,#20232588)" }}>
                    <div style={{ display: "flex", flexDirection: "column", height: pageSize.height, fontFamily: "WebPapyrus" }}>
            <div style={{flex:1}}>
                
                    
                    <NavLink className={(navData) => navData.isActive ? styles.menuActive : styles.menu__item} about="Arcturus Network" to={'/search'}>
                            <img src="Images/logo.png" width={50} height={50} />
                    </NavLink>
                    {camps}
               
                    {/*
                    <NavLink className={(navData) => navData.isActive ? styles.menuActive : styles.menu__item} about="Map"
                        to={'/editor'}>
                        <img src="Images/map.png" width={50} height={45} />
                    </NavLink>*/
                    }
                 

                  
               
            </div>
            <div style={{flex:0.1}}>
                
                <NavLink className={(navData) => navData.isActive ? styles.menuActive : styles.menu__item} about="Create Realm"
                    to={'/createRealm'}>
                    <img src="Images/add.png" width={50} height={45} />
                </NavLink>
                


                <NavLink className={(navData) => navData.isActive ? styles.menuActive : styles.menu__item} about={user.userName}
                    to={'/home'}>
                    <img src="Images/icons/person.svg" style={{ filter: "invert(100%)" }} width={45} height={50} />
                </NavLink>
                
            </div>
        </div>
        </div>
        
        }
      
        </>
    )
    
}

export default HomeMenu;

/*
           
   <NavLink className={(navData) => navData.isActive ? styles.menuActive : styles.menu__item} about="New Campaign" 
                to={'/home'}>
                <img src="Images/start.png" width={50} height={45} />
            </NavLink>
            <NavLink className={(navData) => navData.isActive ? styles.menuActive : styles.menu__item} about="Explore Campaigns" 
                to={'/home'}>
                <img src="Images/explore.png" width={50} height={45} />
            </NavLink>
*/