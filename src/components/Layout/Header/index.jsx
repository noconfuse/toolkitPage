import { Avatar, IconButton, Grid, Link, Button, Tabs, Tab } from "@mui/material";
import React, { useCallback } from "react";
import Person2Icon from "@mui/icons-material/Person2";
import { deepOrange } from "@mui/material/colors";
import Weather from "../../Weather";
import { Stack } from "@mui/system";
import { useNavigate } from "react-router";
import logo from '../../../assets/images/logo.jpeg'


export default function Header(props) {
    const navigate = useNavigate()
    // const {menuOpen} = props;
    const goIntroduction = useCallback(()=>{
        navigate('/about')
    },[])

    const [value, setValue] = React.useState(0);

    const handleChange = (event, newValue) => {
      setValue(newValue);
    };

    return (
        <Grid container spacing={2}  className="fixed top-0 z-10 items-center w-full h-24">
            <Grid item xs={8}>
                <Stack direction="row" className="ml-1" color="text.primary">
                    {/* <Avatar component="a" href="/" sx={{mx:2}}>
                        <img className="w-12 mx-2 rounded-full" src={logo} alt="" />
                    </Avatar> */}
                </Stack>

                {/* <IconButton size="large" onClick={()=>{
                    props.switch()
                }}>
                    {menuOpen?<MenuOpenIcon></MenuOpenIcon>:<MenuIcon/>}
                    
                </IconButton> */}
            </Grid>
            <Grid item xs={4} sx={{ justifyContent: "flex-end", display: "flex", pr: "20px",color:"text.primary",gap:"10px" }}>
                <Link component="button" variant="body1" onClick={goIntroduction}>关于本站</Link>
                <Weather/>
                <Avatar sx={{ bgcolor: deepOrange[500] }}>
                    <Person2Icon></Person2Icon>
                </Avatar>
            </Grid>
        </Grid>
    );
}


