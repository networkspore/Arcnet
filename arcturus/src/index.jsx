import styles from './pages/css/home.module.css';
import loadingStyles from './pages/css/loading.module.css';

import React, { useEffect, useState, Suspense } from "react";
import {createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';

import { Canvas} from '@react-three/fiber';


import { CookiesProvider } from 'react-cookie';

import LoginPage from "./pages/LoginPage";

import WelcomePage from "./pages/WelcomePage";


import {  Stars } from '@react-three/drei';
import  SolarSystem from './pages/components/SolarSystem';

import { Transition } from './pages/components/Camera/Transition';

import useZust from './hooks/useZust';
import Sizing from './dom/Sizing';


import EditorPage from './pages/EditorPage';
import { MapSelector } from './pages/components/MapSelector';

import  {CharacterSelection}  from './pages/components/CharacterSelection';
import CampaignPage from './pages/CampaignPage';
import CreateCampaignPage from './pages/CreateCampaignPage';
import AdminPage from './pages/AdminPage';
import FinalizeCampaign from './pages/FinalizeCampaign';
import { PlaceableViewer } from './pages/components/PlaceableViewer';


import HomeMenu from './pages/HomeMenu';

import { SearchPage } from './pages/SearchPage';
import { HomePage } from './pages/HomePage';








const Loader = (<>  <div className={loadingStyles.loading}  >
    <div >
        <div className={loadingStyles.logo}></div>
        <div className={loadingStyles.loadingText}>
            Loading

        </div>

    </div>

</div></>);

//const socket = io("te1.tunnelin.com:54600");

const App = () => {

    const user = useZust((state) => state.user);

    const page = useZust((state) => state.page);
    const pageSize = useZust((state) => state.pageSize);

 
    return (
        
                <CookiesProvider>
                   
                        
                    <div style={{width: pageSize.width, height: pageSize.height, display:'flex', flexDirection:'column' }}>
                        <div style={{ flex: 1, display: page!=null ? "block": "none" }}>
                            {page!= null  &&
                                <Suspense fallback={Loader}>

                                <Canvas  performance={{ min: 0.5, debounce: 100 }} mode="concurrent" shadows  camera={{ fov: 60, near: 1.0, far: 1000.0, position: [0, 10, 5] }}>

                                        <Transition position={[0, 10, 5]} />
                                        {(page < 10 &&
                                            <>

                                                <SolarSystem position={[0, 0, 0]} />


                                                <Stars radius={400} depth={200} count={10000} factor={4}  />
                                            </>
                                        )}
                                        {(page == 10 &&
                                            <>
                                                <MapSelector /></>
                                        )}

                                        {(page == 12 &&
                                            <>

                                                <CharacterSelection />
                                            </>
                                        )}
                                        {(page == 13 &&
                                            <>

                                                <PlaceableViewer />
                                            </>
                                        )}


                                    </Canvas>
                                </Suspense>   
                            }
                        </div>
                       
                <Routes>
                   

                    {user.userID < 1 &&
                        <>
                            <Route path='/' element={<LoginPage /> } />
                            <Route path='/welcome' element={<WelcomePage />} />


                        </>
                    }

                    {user.userID > 0 &&
                        <>

                        <Route path='/' element={<Navigate to={'/search'} />} />

                        <Route path='/search' element={<SearchPage />} />
                            <Route path='/home' element={<HomePage />} />
                           

                            <Route path='/realm' element={<CampaignPage />}>
                                <Route path="*" element={<CampaignPage />} />
                            </Route>


                            <Route path='/createRealm' element={<CreateCampaignPage />} />
                            <Route path='/finalizeRealm' element={<FinalizeCampaign />} />


                            {user.Admin == 1 &&
                                <>
                                    <Route path='/admin' element={<AdminPage />} />
                                </>
                            }
                        </>
                    }

  

                    <Route path='*' element={ <Navigate to={'/'} />} />
                </Routes>   
                
                <HomeMenu />
                
                        </div>
                    
                
             
                   
            <Sizing />
                   
                </CookiesProvider>
     
    );
}

const element = (
    <Router>
        <App />
    </Router>
);
const container = document.getElementById('root');

const root = createRoot(container);

root.render(element);




        