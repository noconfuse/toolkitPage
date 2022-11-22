import React, { useEffect, useMemo, useState } from 'react';
import { Stack } from '@mui/system';
import { getLocation, getWeather } from "../../service";
import { Chip } from '@mui/material';


export default function Weather() {
    const [weatherList, setWeatherList] = useState([{}]);
    useEffect(() => {
        getLocation().then(res => {
            const { city } = res
            getWeather({
                page: 1,
                pageSize: 7,
                city
            }).then(res => {
                setWeatherList(res.data.list)
            })
        })

    }, [setWeatherList])


    const todayWeather = useMemo(()=>{
        return weatherList[0]||{}
    },[weatherList])



    return (<Stack direction="row" spacing={1} className="select-none" alignItems="center" mr="20px">

        <span>{todayWeather.city}</span>
        <span>{todayWeather.weather}</span>
        <span>{todayWeather.temp}°C</span>
        <Chip label={todayWeather.airQuality} variant="filled" size="small" color={["优","良"].includes(todayWeather.airQuality)?'success':'warning'}>

        </Chip>
    </Stack>)
}