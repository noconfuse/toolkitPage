import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function Scrapy() {
    // const location = useLocation();
    // console.log(location)
    useEffect(() => {
        setTimeout(()=>{
            const iframe = document.getElementById("targetWebSite");
            const iframeDom = iframe.contentDocument || iframe.contentWindow.document;
            console.log(iframeDom, "iframeDom")
            const iframeScript = iframeDom.createElement("script");
            const scriptSource = iframeDom.createTextNode(`
                             window.addEventListener('DOMContentLoaded',function(){
                                 console.log('我是你爸爸')
                             })
                         `);
            iframeScript.appendChild(scriptSource);
            console.log(iframeDom)
            iframeDom.body.appendChild(iframeScript)
        },5000)
    }, [])


    return (
        <div>
            <div className="w-2/3 h-screen">
                <iframe id="targetWebSite" className="w-full h-full" src="https://www.likecs.com/ask-1300605.html" onLoadedData={() => {

                }}>
                </iframe>
            </div>
            <div></div>
        </div>
    )
}