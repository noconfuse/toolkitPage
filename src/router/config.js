
import Landing from '../views/Landing'
import Tools from '../views/Tools'
import NotFound from '../views/NotFound'
import PersonIcon from '@mui/icons-material/Person';
import ConstructionIcon from "@mui/icons-material/Construction";
import About from '../views/About';


const routesConfig = [
    {
        name:"首页",
        path:'/',
        component:Landing,
        meta:{
            title:"首页",
            hide:true
        }
    },
    {
        name:"关于本站",
        path:"/about",
        component:About,
        meta:{
            title:"关于本站"
        }
    },
    {
        name:"实用工具",
        path:"/tools",
        component:Tools,
        meta:{
            title:"实用工具",
            icon:ConstructionIcon,
        }
    },
    {
        name:"博客文章",
        path:"/blogs",
        component:NotFound,
        meta:{
            title:"博客文章",
            icon:PersonIcon,
        }
    }
]

export default routesConfig