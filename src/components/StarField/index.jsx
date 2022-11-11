import axios from 'axios';
import React, { useEffect } from 'react';
import { STNPlayer } from '../../utils/shaderToy/shaderPlayer.ts';
import './index.scss'


export default function StarField(){

    useEffect(()=>{
        const cavans = document.getElementById('startField')
        const gl = cavans.getContext('webgl2');
        const stnPlayer = new STNPlayer(gl)
        
        axios.get(`${process.env.PUBLIC_URL}/glsl/iceWorld.glsl`).then(res=>{
            const glsl = res.data
            stnPlayer.run(glsl)
        })

    },[])

    return <canvas id="startField" className="absolute top-0 left-0" ></canvas>
}



    
    



    


