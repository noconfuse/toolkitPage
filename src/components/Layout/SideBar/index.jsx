import {
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemButton,
} from "@mui/material";
import React from "react";
import { Box } from "@mui/system";
import logo from '../../../assets/images/logo.jpeg'
import { useNavigate } from "react-router";

export default function SideBar(props) {
    const { routes, menuOpen = true } = props;
    const navigate = useNavigate()
    const jumpLink = (url) => {
        if (!url) return;
        if (url.startsWith('http')) {
            window.location.href = url
        } else {
            navigate(url)
        }
    }

    const renderListItem = (routes) => {
        return routes.map((route) => {
            const { meta = {} } = route;
            if (!meta.hide) {
                return (
                    <ListItem key={meta.title} onClick={() => { jumpLink(route.path) }}>
                        <ListItemButton>
                            <ListItemIcon>
                                <meta.icon></meta.icon>
                            </ListItemIcon>
                            <ListItemText primary={meta.title} sx={{ color: "text.primary", wordBreak: "keep-all" }} />
                        </ListItemButton>
                    </ListItem>
                );
            }
        });
    };

    return (
        <Box sx={{ width: `${menuOpen ? '240px' : '86px'}`, bgcolor: 'background.paper', height: "100vh", float: "left", transition: "width .3s linear", position: 'relative', zIndex: "10", overflow: "hidden" }}>
            <Box sx={{ color: "text.primary", fontWeight: "fontWeightBold", fontSize: "26px", textAlign: "center" }} onClick={()=>{
                window.location.href = '/'
            }}>
                <img className="w-16 mx-auto my-2 rounded-full" src={logo} alt="" />
            </Box>
            <List>{renderListItem(routes)}</List>
        </Box>
    );
}
