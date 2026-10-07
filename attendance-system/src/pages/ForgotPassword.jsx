import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { isValidEmail } from "../utils/emailValidation";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return alert("Please enter your email address.");
    if (!isValidEmail(email)) return alert("Please enter a valid email address.");
    if (email.trim().length > 254) return alert("Email cannot exceed 254 characters.");
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/reset-password",
      });
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return <div style={styles.container}><div style={styles.overlay}/><div style={styles.card}>
    <img src="/logo.png" alt="CIBO logo" style={styles.logo}/>
    <h1 style={styles.title}>Forgot Password?</h1>
    <p style={styles.text}>Enter your account email to request a password reset link.</p>
    {sent ? <div style={styles.message}>If an account exists for this email, a password reset link has been sent. Please check your inbox.</div> :
      <form onSubmit={submit}>
        <label style={styles.label}>Email <span style={styles.required}>*</span></label>
        <input type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" style={styles.input}/>
        <button disabled={loading} style={styles.button}>{loading ? "Sending..." : "Send Reset Link"}</button>
      </form>}
    <button type="button" onClick={() => navigate("/")} style={styles.back}>Back to Login</button>
  </div></div>;
}
const styles = {
 container:{minHeight:"100vh",width:"100%",backgroundImage:"url('/bg.jpg')",backgroundSize:"cover",backgroundPosition:"center",display:"flex",justifyContent:"center",alignItems:"center",position:"relative",padding:"24px",boxSizing:"border-box"},
 overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.58)"},card:{position:"relative",zIndex:1,width:"100%",maxWidth:"390px",background:"#fff",padding:"36px",borderRadius:"14px",boxShadow:"0 18px 45px rgba(0,0,0,.28)",borderTop:"4px solid #f97316",boxSizing:"border-box"},logo:{display:"block",width:"62px",height:"62px",objectFit:"contain",margin:"0 auto 16px"},title:{margin:"0 0 8px",textAlign:"center",color:"#111827"},text:{color:"#6b7280",fontSize:"14px",lineHeight:1.5,textAlign:"center",marginBottom:"24px"},label:{display:"block",fontSize:"13px",fontWeight:"600",marginBottom:"7px",color:"#374151"},required:{color:"#dc2626"},input:{width:"100%",boxSizing:"border-box",padding:"12px 13px",borderRadius:"8px",border:"1px solid #d1d5db"},button:{width:"100%",marginTop:"16px",padding:"12px",border:0,borderRadius:"8px",background:"#f97316",color:"#fff",fontWeight:"700"},message:{padding:"13px",background:"#f3f4f6",borderRadius:"8px",fontSize:"13px",lineHeight:1.5,color:"#374151"},back:{display:"block",width:"100%",marginTop:"18px",padding:"10px",border:0,background:"transparent",color:"#ea580c",fontWeight:"600"}
};