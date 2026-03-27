import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, User, Camera } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Settings() {
  const { user, token, logout, refreshUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isPlayful = theme === 'playful';
  const [profilePic, setProfilePic] = useState(user?.profile_picture || '');

  useEffect(() => {
    setProfilePic(user?.profile_picture || '');
  }, [user?.profile_picture]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleProfilePicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        setProfilePic(base64String);
        try {
          await axios.patch(
            `${API}/user/profile-picture`,
            { profile_picture: base64String },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          await refreshUser();
          toast.success('Profile picture updated!');
        } catch (error) {
          toast.error('Failed to update profile picture');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className={isPlayful ? 'rounded-full' : 'rounded-md'}
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
          <div className="w-10"></div>
        </div>

        {/* Profile Section */}
        <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative group">
              <div 
                className={`w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold cursor-pointer overflow-hidden ${
                  isPlayful ? 'playful-shadow' : 'clean-shadow'
                }`}
                onClick={() => document.getElementById('profilePicInput').click()}
              >
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              </div>
              <input
                id="profilePicInput"
                type="file"
                accept="image/*"
                onChange={handleProfilePicUpload}
                className="hidden"
                data-testid="profile-pic-input"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold">{user.username}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Level</p>
              <p className="text-2xl font-bold">{user.accountable_level}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total XP</p>
              <p className="text-2xl font-bold">{user.accountable_xp}</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className={`bg-card p-6 border ${isPlayful ? 'playful-border playful-shadow rounded-[1.5rem]' : 'clean-border clean-shadow rounded-lg'}`}>
          <h2 className="text-xl font-bold mb-4">Quick Links</h2>
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/groups')}
              variant="outline"
              className={`w-full justify-start ${isPlayful ? 'rounded-full' : 'rounded-md'}`}
              data-testid="groups-link"
            >
              <User className="w-4 h-4 mr-2" />
              Manage Groups
            </Button>
          </div>
        </div>

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="destructive"
          className={`w-full ${isPlayful ? 'rounded-full' : 'rounded-md'}`}
          data-testid="logout-button"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
}
