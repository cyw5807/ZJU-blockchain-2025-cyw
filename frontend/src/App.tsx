import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import MyTicketsPage from './pages/my-tickets';
import CreateActivityPage from './pages/create-activity';
import BuyTicketPage from './pages/buy-ticket';
import SellTicketPage from './pages/sell-ticket';
import BuyListedTicketPage from './pages/buy-listed-ticket';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <div className="content">
          <Routes>
            <Route path="/my-tickets" element={<MyTicketsPage />} />
            <Route path="/create-activity" element={<CreateActivityPage />} />
            <Route path="/buy-ticket" element={<BuyTicketPage />} />
            <Route path="/sell-ticket" element={<SellTicketPage />} />
            <Route path="/buy-listed-ticket" element={<BuyListedTicketPage />} />
            <Route path="/" element={<MyTicketsPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;