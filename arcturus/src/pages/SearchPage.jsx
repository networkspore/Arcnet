
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

    const [requestContact, setRequestContact] = useState(null)

    const messageRef = useRef();

    const onSearch = (e = new Event("search")) => {
        const {value} = e.target;
        
        if(value == "")
        {
            setPeopleFound([])
            setSearchActive(false);
        }else{
            if(value.length > 2){
                setSearchActive(true);
            }else{
                setPeopleFound([])
                setSearchActive(false);
            }
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

    const addContact = (c) => {
        console.log(c)
    }

    const removePerson = (userID) => {
        setPeopleFound(produce((state)=>{
            
            let i = 0;
            while(i < state.length)
            {
                if(state[i].userID == userID){
                    state.splice(i, 1)
                }
                i++;
            }
        }))
    }

    const onRequestContact = () => {
        if(requestContact != null)
        {
            let contact = requestContact;
            let msg = messageRef.current.value;
            socket.emit("requestContact", contact.userID, msg, (complete) => {
                const msg = complete.msg;
                if (complete.requested == true){
                    contact["status"] = { statusID: 3, statusName: "confirming" };
                    addContact(contact)
                    removePerson(contact.userID)
                    setRequestContact(null)
                    alert(msg)
                }else{
                    alert(msg)
                    setRequestContact(null)
                }
                messageRef.current.value = "";

            })
            
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
                <div onClick={(e)=>{
                    setRequestContact(peopleFound[i])
                }} style={{ display: "flex", fontFamily:"WebPapyrus" }} className={styles.result}>
                    
                    <div style={{ flex: 1, color: "white" }}>{name}</div>
            
                </div>
            )
       }
       
        setFoundList(tmpArray)
    }
    if(peopleFound.length < 1)
    {
        if(foundList.length != 0)
        {
            setFoundList([])
        }
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
                        <div style={{
                            marginBottom: '2px',
                            marginLeft: "10px",
                            height: "1px",
                            width: "100%",
                            backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)",
                        }}>&nbsp;</div>
                    <div style={{ display: "block", backgroundColor: "rgba(6, 6, 5, .5)" , width: 300, height: pageSize.height}}>
                        <div style={{ 
                        border: "2px solid #000000", 
                        borderTopWidth: "5px",
                                backgroundImage: "linear-gradient(to right, #04040550 , #66666630,#04040550)",  
                        width:"100%" , 
                        height:"40px", 
                        paddingTop: "10px", 
                        paddingBottom:"10px",
                        paddingLeft:"3px"

                        }}>
                            <div style={{display:"flex", paddingTop:"4px"}}>
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
                                    placeholder="Find peers and realms" />
                            </div>
                        </div>
                            <div style={{
                                marginBottom: '2px',
                                marginLeft: "10px",
                                height: "1px",
                                width: "100%",
                                backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)",
                            }}>&nbsp;</div>
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
              
                <div style={{
                    paddingTop:"20px",
                    paddingBottom:"6px",
                    fontWeight:"bolder",
                    textAlign:"center",
                    width:"100%",
                    fontSize:"20px",
                    fontFamily:"WebPapyrus",
                        color: "#777777",
                        textShadow:"2px 2px 2px black",
                        backgroundImage:"linear-gradient(to right, #00000010, #77777720, #00000010)"
                }}>
                    Peers
                </div>
                <div style={{marginLeft:"15px"}}>
                        <div style={{
                            marginBottom: '2px',
                            marginLeft: "10px",
                            height: "1px",
                            width: "100%",
                            backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)",
                        }}></div>
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
            { requestContact != null &&
                
                < div style={{
                        position: "fixed",
                        backgroundColor: "rgba(20,23,25,.7)",
                        width: 300,
                        left: 685,
                        top: "75px",
                        height: 210,
                }}>
                    <div style={{
                       
                     
                        height: "1px",
                        width: "100%",
                        backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)",
                        fontFamily: "Webrockwell",
                        color: "white"
                    }}>&nbsp;</div>
                  
                    <div style={{
                        fontWeight: "bolder",
                        textAlign: "center",
                        width: "100%",
                        fontSize: "16px",
                        fontFamily: "WebPapyrus",
                        color: "#777777",
                        textShadow: "3px 3px 4px black",
                        paddingTop:"10px",
                        paddingBottom:"6px",
                           backgroundImage: "linear-gradient(to right, #00000010, #77777720, #00000010)"
                    }}>
                       Request &nbsp; &nbsp; Contact
                    </div>
                    <div style={{   }}>
                        <div style={{
                            marginBottom: '2px',
                           
                            height: "1px",
                            width: "100%",
                            backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)",
                            
                        }}></div>
                        <div style={{
                            fontFamily:"WebPapyrus",
                            color:"#cdd4da",
                             textAlign: "center",
                            width: "100%",
                            paddingTop:"15px",
                            textShadow: "3px 3px 4px black"
                            
                        }}>
                        {requestContact.userName}
                        </div>
                        <div style={{
                            marginTop:"10px",
                            marginLeft:"10px",
                            marginRight:"10px",
                            display:"flex", 
                            flex:1, 
                            alignItems: "center",
                            justifyContent: "center", 
                           
                            
                            }}>
                            <textarea  placeholder="Write a brief message..." style={{resize:"none", fontSize:"12px",  width:"80%",border:0, backgroundColor:"#00000060", color:"white", fontFamily:"Webrockwell"}} ref={messageRef}  />
                        </div>
                        <div style={{
                            marginBottom: '2px',

                            height: "1px",
                            width: "100%",
                            backgroundImage: "linear-gradient(to right, #000304DD, #77777755, #000304DD)",

                        }}></div>
                            <div style={{
                              
                                paddingLeft:"40px",
                                display: "flex",
                                }}>
                                    <div style={{display:"flex"}}>
                                    <div style={{
                                        justifyContent: "center",
                                    

                                        display: "flex",
                                        alignItems: "center"
                                    }}>

                                        <div style={{ 
                                            paddingLeft: "10px", 
                                            paddingRight: "10px", 
                                            fontFamily:"WebPapyrus" 
                                            }} 
                                            className={styles.CancelButton} 
                                            onClick={(e)=>{setRequestContact(null)}} >
                                                Cancel
                                        </div>

                                    </div>
                                <div style={{
                                  
                                    marginLeft: "10px", marginRight: "10px",
                                    height: "80px",
                                    width: "1px",
                                    backgroundImage: "linear-gradient(to bottom, #000304DD, #77777755, #000304DD)",
                                }}></div>
                                    <div style={{
                                    justifyContent: "center",


                                    display: "flex",
                                    alignItems: "center"
                                }}>

                                    <div style={{ 
                                        paddingLeft: "10px", 
                                        paddingRight: "10px", 
                                        fontFamily:"WebPapyrus",
                                        width:"80px"
                                    }} 
                                    className={styles.OKButton} 
                                    onClick={(e)=>{onRequestContact()}} >
                                        Request
                                    </div>

                                </div>
                            </div>
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