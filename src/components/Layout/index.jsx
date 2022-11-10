import { Box } from '@mui/system';
import React, { Component, useCallback, useState } from 'react';
import StarField from '../StarField';
import Header from './Header';
import './index.scss';
import SideBar from './SideBar';

export default function Layout(props) {
    const { routesConfig } = props;
    const [open, setOpen] = useState(true);
    const switchOpen = useCallback(() => {
        setOpen(!open)
    }, [setOpen, open])
    return (
        <div className="relative appContent">
            <Box sx={{ position: "absolute", width: "100%", height: "100vh" }}>
                <StarField />
            </Box>
            <SideBar routes={routesConfig} menuOpen={open} />
            <div className="relative z-10 overflow-x-hidden">
                <Header switch={switchOpen} menuOpen={open}></Header>
                <div className="mx-auto main">
                    {props.children}
                </div>
            </div>
        </div>
    )
}