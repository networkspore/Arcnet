
import React, { useState, useEffect, useRef } from "react";

import { useNavigate } from 'react-router-dom';
import useZust from "../hooks/useZust";
import SearchResults from "./components/UI/SearchResults";
import produce from "immer";

import styles from './css/home.module.css';




export const SearchPage = () => {

    

  //  const setFillMainOverlay = useZust((state) => state.setFillMainOverlay);
    
   
    const setPage = useZust((state) => state.setPage)

    
    const pageSize = useZust((state) => state.pageSize);

    const scrollLeft = useZust((state) => state.scrollLeft);
    const scrollTop = useZust((state) => state.scrollTop);
  
   
    const [searchActive, setSearchActive] = useState(false);
    const [peopleFound, setPeopleFound] = useState([]);
    const [campaignsFound, setCampaignsFound] = useState([])

    const [foundList, setFoundList] = useState([])

    const socket = useZust((state) => state.socket);
    const user = useZust((state) => state.user)

    const searchInputRef = useRef();

    const onSearch = (e = new Event("search")) => {
        const {value} = e.target;
        
        if(value == "")
        {
            setSearchActive(false);
        }else{
            setSearchActive(true);
        }
        
        if(value.length > 2)
        {
            socket.emit('searchPeople', value, user.userID, (response) => {
                setPeopleFound(response);
           
            })
           /*socket.emit("searchCampaigns", value, user.userID, (response) => {
               setCampaignsFound(response);
            }) */
        }else{
            setPeopleFound(produce((state) => {state = []}))
            //setCampaignsFound(produce((state) => { state = [] }))
        }
    }

useEffect(()=>{
    setPage(3)
},[])

useEffect(()=>{
    if(searchActive && peopleFound.length > 0){
       let tmpArray = [];

       for(let i = 0; i < peopleFound.length ; i++){

            const name =  peopleFound[i].userName;

            tmpArray.push(
                <div style={{ display: "flex", fontFamily:"WebPapyrus" }} className={styles.result}>
                    
                    <div style={{ flex: 1, color: "white" }}>{name}</div>
            
                </div>
            )
       }
       
        setFoundList(tmpArray)
    }
},[peopleFound])

  
const endSearch = () => {
    searchInputRef.current.value = "";
    setSearchActive(false);
}


 //"inset 10px #boxShadow:"inset -5px 0 0 #776a05DD, inset 0 -5px 0 #776a05DD, inset 0px 0 0 #776a05, inset 0 0px 0 #776a05"776a05"
 //boxShadow:"inset -5px 0 0 #776a05DD, inset 0 -5px 0 #776a05DD, inset 0px 0 0 #776a05, inset 0 0px 0 #776a05"
    return (
        <>

        <div style={{ width: 85, height: pageSize.height, backgroundColor: "rgba(4,4,5,.5)", position: "fixed", padding: 0,  left:85, top: 0 }}>
                <div style={{ display:"flex"}}>
                  
                <div>
            
                    <div style={{ display: "block", backgroundColor: "rgba(4, 4, 5, .5)" , width: 300, height: pageSize.height}}>
                        <div style={{ border: "2px solid #000000", borderTopWidth: "5px",  width:"100%" , height:"40px", paddingTop: "10px", paddingBottom:"10px" }}>
                            <div style={{paddingTop:"8px"}}>
                                    <input onKeyDown={(e)=>{
                                    if(e.key == "Esc"){
                                        endSearch();
                                    }  
                                    }} 
                                    ref={searchInputRef} 
                                    style={{ color: searchActive ? "white" : "#62717d"}} 
                                    onChange={e => onSearch(e)} 
                                    className={styles.searchInput} 
                                    type="text" 
                                    placeholder="Find contacts and realms" />
                            </div>
                        </div>
                        <div style={{ 
                            border: "2px solid #000000", 
                            height: "100%", 
                            padding: "2px", 
                            backgroundColor: "#03040550",  
                            }}>
                                
                        </div>
                    </div>
                </div>  
        
            </div>
        </div>
            {searchActive &&
            <div style={{ 
                position: "fixed", 
                backgroundColor: "rgba(10,13,14,.6)", 
                width: 300, 
                left: 385, 
                top: "0px",
                height: pageSize.height,
            }}>
                <div style={{
                    marginBottom: '2px',
                    marginLeft: "10px",
                    height: "1px",
                    width: "100%",
                    backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)",
                    fontFamily:"Webrockwell",
                    color:"white"
                }}>&nbsp;</div>
                <div style={{height:"30px"}}>

                </div>
                <div style={{marginLeft:"15px", marginTop:"30px"}}>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    height: pageSize.height /3,
                    flex: 1,
                    
                    overflowY: "scroll",
                    color: "#cdd4da",
                    padding:"10px"
                }}
                >
                    {foundList}
                </div>
                    </div>
            </div>
            }
        </>
    );
    

};


/*   

     const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

     useEffect(() => {
         function handleResize() {
             setWindowDimensions(prevDimensions => 
                 getWindowDimensions()
             );
             //    setWindowDimensions();
         }

         window.addEventListener('resize', handleResize);
         return () => window.removeEventListener('resize', handleResize);
     }, []);*/