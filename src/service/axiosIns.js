import axios from 'axios';


const axiosIns = axios.create({
    baseURL:"//182.160.13.1:3001"
})

export default axiosIns;