import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainWorkflowPage from './pages/MainWorkflowPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import OutputSetupPage from './pages/OutputSetupPage';
import ProfileOverviewPage from './pages/ProfileOverviewPage';
import InvoiceQueueListPage from './pages/InvoiceQueueListPage';
import GeneralInvoiceSetup from './pages/GeneralInvoiceSetup';
import GeneralOverviewPage from './pages/GeneralInvoiceOverview';
import './App.css'

function App() {
  

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/workflow" />} />
        <Route path="/workflow" element={<MainWorkflowPage />} />
        <Route path="/setup-profile" element={<ProfileSetupPage />} />
        <Route path="/setup-profile/:name" element={<ProfileSetupPage />} />
        <Route path="/setup-output" element={<OutputSetupPage />} />
        <Route path="/profiles" element={<ProfileOverviewPage />} />
        <Route path="/invcqueue" element={<InvoiceQueueListPage />} />
        <Route path="/general-invc" element={<GeneralInvoiceSetup />} />
        <Route path="/general-overview" element={<GeneralOverviewPage />} />
      </Routes>

      
    </Router>
  );

}

export default App
