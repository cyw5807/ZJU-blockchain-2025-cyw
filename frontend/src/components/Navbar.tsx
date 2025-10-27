import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../App.css';

const Navbar: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="navbar">
      <ul className="navbar-nav">
        <li className={`nav-item ${location.pathname === '/my-tickets' ? 'active' : ''}`}>
          <Link to="/my-tickets" className="nav-link">我的彩票</Link>
        </li>
        <li className={`nav-item ${location.pathname === '/create-activity' ? 'active' : ''}`}>
          <Link to="/create-activity" className="nav-link">创建竞彩项目</Link>
        </li>
        <li className={`nav-item ${location.pathname === '/buy-ticket' ? 'active' : ''}`}>
          <Link to="/buy-ticket" className="nav-link">购买彩票</Link>
        </li>
        <li className={`nav-item ${location.pathname === '/sell-ticket' ? 'active' : ''}`}>
          <Link to="/sell-ticket" className="nav-link">挂单出售彩票</Link>
        </li>
        <li className={`nav-item ${location.pathname === '/buy-listed-ticket' ? 'active' : ''}`}>
          <Link to="/buy-listed-ticket" className="nav-link">购买挂单出售的彩票</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;