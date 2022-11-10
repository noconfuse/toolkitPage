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

export default function SideBar(props) {
  const { routes, menuOpen=true } = props;

  const jumpLink = ()=>{
      
  }

  const renderListItem = (routes) => {
    return routes.map((route) => {
      const { meta = {} } = route;
      if (!meta.hide) {
        return (
          <ListItem  key={meta.title} onClick={jumpLink}>
            <ListItemButton>
              <ListItemIcon>
                <meta.icon></meta.icon>
              </ListItemIcon>
              <ListItemText  primary={meta.title} sx={{color:"text.primary",wordBreak:"keep-all"}}/>
            </ListItemButton>
          </ListItem>
        );
      }
    });
  };

  return (
    <Box sx={{  width: `${menuOpen?'240px':'86px'}`, bgcolor: 'background.paper',height:"100vh", float:"left" ,transition:"width .3s linear",position:'relative',zIndex:"10"}}>
      <Box sx={{color:"text.primary",fontWeight:"fontWeightBold",fontSize:"26px",textAlign:"center"}}>
          <img className="w-16 mx-auto my-2 rounded-full" src={logo} alt=""/>
      </Box>
      <List>{renderListItem(routes)}</List>
    </Box>
  );
}
