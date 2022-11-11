import { Avatar, IconButton, Grid } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import React from "react";
import Person2Icon from "@mui/icons-material/Person2";
import { deepOrange } from "@mui/material/colors";
import Weather from "../../Weather";

export default function Header(props) {
    const {menuOpen} = props;
    return (
        <Grid container spacing={2}  className="fixed top-0 z-10 items-center w-full h-24">
            <Grid item xs={8}>
                {/* <IconButton size="large" onClick={()=>{
                    props.switch()
                }}>
                    {menuOpen?<MenuOpenIcon></MenuOpenIcon>:<MenuIcon/>}
                    
                </IconButton> */}
            </Grid>
            <Grid item xs={4} sx={{ justifyContent: "flex-end", display: "flex", pr: "20px",color:"text.primary" }}>
               <Weather/>
                <Avatar sx={{ bgcolor: deepOrange[500] }}>
                    <Person2Icon></Person2Icon>
                </Avatar>
            </Grid>
        </Grid>
    );
}
