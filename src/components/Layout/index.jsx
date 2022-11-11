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
        <div className="relative flex items-stretch appContent">
            <SideBar routes={routesConfig} menuOpen={open} />
            <div className="relative z-10 flex-1 overflow-x-hidden">
                <div className="h-fit">
                    <Box sx={{ position: "absolute", width: "100%", height: "480px" }}>
                        <StarField />
                    </Box>
                    <Header switch={switchOpen} menuOpen={open}></Header>
                </div>
                <div className="mx-auto main">
                    {props.children}
                </div>
            </div>
        </div>
    )
}