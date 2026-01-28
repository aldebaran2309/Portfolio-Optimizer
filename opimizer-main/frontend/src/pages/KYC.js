import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { CheckCircle, Upload, FileText } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KYC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [country, setCountry] = useState('IN');
  const [documents, setDocuments] = useState({});
  const [kycStatus, setKycStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }
    fetchKYCStatus();
  }, [token]);

  const fetchKYCStatus = async () => {
    try {
      const response = await axios.get(`${API}/kyc/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKycStatus(response.data);
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    }
  };

  const handleDocumentSubmit = async (documentType, documentNumber) => {
    setLoading(true);
    try {
      await axios.post(
        `${API}/kyc/submit-document-data`,
        {
          document_type: documentType,
          document_number: documentNumber,
          country
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`${documentType} submitted successfully`);
      fetchKYCStatus();
      
      // Clear the input
      setDocuments({ ...documents, [documentType]: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit document');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (documentType, file) => {
    if (!file) return;

    setUploadProgress({ ...uploadProgress, [documentType]: 0 });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    try {
      await axios.post(
        `${API}/kyc/upload-document-file`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress({ ...uploadProgress, [documentType]: percentCompleted });
          }
        }
      );
      
      toast.success(`${documentType} file uploaded successfully`);
      setUploadProgress({ ...uploadProgress, [documentType]: 100 });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'File upload failed');
      setUploadProgress({ ...uploadProgress, [documentType]: 0 });
    }
  };

  const documentTypes = country === 'IN'
    ? [
        { type: 'PAN', label: 'PAN Card', placeholder: 'ABCDE1234F' },
        { type: 'AADHAR', label: 'Aadhar Card', placeholder: '1234 5678 9012' }
      ]
    : [
        { type: 'SSN', label: 'Social Security Number', placeholder: '123-45-6789' },
        { type: 'PASSPORT', label: 'Passport Number', placeholder: 'A12345678' }
      ];

  const isDocumentSubmitted = (type) => {
    return kycStatus?.documents?.some(doc => doc.document_type === type);
  };

  return (
    <div className="min-h-screen p-8 bg-obsidian">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-5xl font-black tracking-tighter mb-4">KYC VERIFICATION</h1>
          <p className="text-slate-400">Complete your KYC to link brokerage accounts</p>
        </div>

        {/* Country Selection */}
        <Card className="glass mb-6">
          <CardHeader>
            <CardTitle>Select Your Country</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger data-testid="country-select" className="bg-gunmetal border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="US">United States</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Document Submission */}
        <div className="space-y-6">
          {documentTypes.map(({ type, label, placeholder }) => (
            <Card key={type} className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {label}
                      {isDocumentSubmitted(type) && (
                        <CheckCircle className="w-5 h-5 text-neon-mint" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {isDocumentSubmitted(type)
                        ? 'Document submitted and under verification'
                        : `Enter your ${label} details`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Document Number Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Document Number
                  </label>
                  <div className="flex gap-2">
                    <Input
                      data-testid={`${type.toLowerCase()}-input`}
                      type="text"
                      value={documents[type] || ''}
                      onChange={(e) => setDocuments({ ...documents, [type]: e.target.value })}
                      placeholder={placeholder}
                      disabled={isDocumentSubmitted(type)}
                      className="bg-gunmetal border-white/10 text-white flex-1"
                    />
                    <Button
                      data-testid={`submit-${type.toLowerCase()}-button`}
                      onClick={() => handleDocumentSubmit(type, documents[type])}
                      disabled={loading || !documents[type] || isDocumentSubmitted(type)}
                      className="bg-electric-indigo hover:bg-electric-indigo/90"
                    >
                      Submit
                    </Button>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Upload Document Scan (PDF/Image)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      data-testid={`${type.toLowerCase()}-file-input`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(type, e.target.files[0])}
                      className="bg-gunmetal border-white/10 text-white"
                    />
                    {uploadProgress[type] > 0 && uploadProgress[type] < 100 && (
                      <span className="text-sm text-neon-mint">{uploadProgress[type]}%</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Summary */}
        {kycStatus && (
          <Card className="glass mt-6">
            <CardHeader>
              <CardTitle>KYC Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Overall Status:</span>
                  <span className={`font-bold ${
                    kycStatus.kyc_status === 'verified' ? 'text-neon-mint' :
                    kycStatus.kyc_status === 'submitted' ? 'text-amber-400' :
                    'text-slate-400'
                  }`}>
                    {kycStatus.kyc_status?.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Documents Submitted:</span>
                  <span className="font-bold text-white">{kycStatus.documents?.length || 0}</span>
                </div>
                {kycStatus.has_all_documents && (
                  <div className="mt-4 p-3 bg-neon-mint/10 border border-neon-mint/30 rounded-sm">
                    <p className="text-sm text-neon-mint">
                      ✓ All required documents submitted. Verification in progress.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Continue Button */}
        <div className="mt-8 flex justify-end">
          <Button
            data-testid="continue-button"
            onClick={() => navigate('/dashboard')}
            className="bg-electric-indigo hover:bg-electric-indigo/90 glow px-8"
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KYC;
