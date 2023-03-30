import { Tab, Tabs } from '@mui/material';
import { Box } from '@mui/system';
import React, { useState } from 'react';


function TabPanel(props) {
    const { children, value, index, ...other } = props;
  
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        {...other}
      >
        {value === index && (
          <Box color="text.primary">
            {children}
          </Box>
        )}
      </div>
    );
  }


export default function Tools(){
    const [tabValue,setTabValue] = useState(0)
    const handleTabChange = (event,newValue)=>{
        setTabValue(newValue)
    }
    return <Box >
        <Tabs value={tabValue}  textColor="secondary" indicatorColor="secondary" onChange={handleTabChange}>
            <Tab label="chrome 插件" value={0} />
            <Tab label="Item Two" />
        </Tabs>
        <TabPanel value={tabValue} index={0}>

            111111
        </TabPanel>
        <TabPanel value={tabValue} index={1}>

            2222
        </TabPanel>
    </Box>
}