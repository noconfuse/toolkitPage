import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
// import Layout from './components/Layout';
// import Task from './components/Task';
// import Notes from './components/Notes';
// import Category from './components/Category';
// import Address from './components/Address';
// import Tags from './components/Tags'
// import User from './components/User'
// import Login from './components/Login'
// import Register from './components/Register'
import './index.css';
// import App from './App';
import reportWebVitals from './reportWebVitals';
import Layout from './components/Layout';
import RoutesConfig from './router/config'
import { createTheme, ThemeProvider } from '@mui/material/styles';


const root = ReactDOM.createRoot(document.getElementById('root'));


const theme = createTheme({
  palette: {
   mode:"dark"
  },
})

root.render(
  <React.StrictMode>
    <BrowserRouter path="/">
      <ThemeProvider theme={theme}>
      <Layout routesConfig={RoutesConfig}>
        <Routes>
          {
            RoutesConfig.map(config=>(<Route key={config.name} path={config.path} element={<config.component />} />))
          }
        </Routes>
      </Layout>
      </ThemeProvider>
    </BrowserRouter>
   </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
