import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { isValidEmail } from "../utils/emailValidation";

export default function ForgotPassword() {
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(false);
  const [sent,setSent]=useState(false);
  const navigate=useNavigate();

  const submit=async(e)=>{
    e.preventDefault();
    const value=email.trim();
    if(!isValidEmail(value)){ alert("Please enter a valid email address."); return; }
    setLoading(true);
    try{
      const { error } = await supabase.auth.resetPasswordForEmail(value,{redirectTo:`${window.location.origin}/reset-password`});
      if(error){ alert(error.message || "Unable to send the password reset link."); return; }
      setSent(true);
    }catch(error){
      alert(error?.message || "Unable to send the password reset link.");
    }finally{
      setLoading(false);
    }
  };

  return <div className="cibo-login" style={s.container}>
    <div style={s.overlay}/>
    <main className="cibo-login-card" style={s.card}>
      <img src="/logo.png" alt="CIBO" style={s.logo}/>
      {!sent ? <>
        <h1 style={s.title}>Forgot password?</h1>
        <p style={s.subtitle}>Enter your registered email and we'll send you a password reset link.</p>
        <form onSubmit={submit}>
          <label htmlFor="forgot-email" style={s.label}>Email <span style={s.required}>*</span></label>
          <input id="forgot-email" type="email" maxLength={254} autoComplete="email" placeholder="Enter your email" value={email} onChange={e=>setEmail(e.target.value)} style={s.input} disabled={loading}/>
          <button type="submit" style={s.button} disabled={loading}>{loading?"Sending...":"Send reset link"}</button>
        </form>
      </>:<>
        <div style={s.successIcon}>✓</div>
        <h1 style={s.title}>Check your email</h1>
        <p style={s.subtitle}>If an account exists for that email, a password reset link has been sent.</p>
      </>}
      <button type="button" onClick={()=>navigate("/")} style={s.back}>← Back to login</button>
    </main>
  </div>;
}

const s={
 container:{minHeight:"100dvh",width:"100%",backgroundImage:"url('/bg.jpg')",backgroundSize:"cover",backgroundPosition:"center",display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 20px",boxSizing:"border-box",position:"relative"},
 overlay:{position:"fixed",inset:0,background:"linear-gradient(135deg,rgba(15,23,42,.72),rgba(15,23,42,.52) 45%,rgba(249,115,22,.18))"},
 card:{position:"relative",zIndex:1,width:"min(430px,100%)",boxSizing:"border-box",background:"rgba(255,255,255,.97)",padding:"38px 42px 30px",borderRadius:"24px",boxShadow:"0 28px 70px rgba(0,0,0,.28)",textAlign:"center"},
 logo:{width:"72px",height:"72px",objectFit:"contain",borderRadius:"14px",marginBottom:"22px"},
 title:{margin:"0 0 9px",color:"#172033",fontSize:"28px",lineHeight:"1.2",fontWeight:"750"},
 subtitle:{margin:"0 0 24px",color:"#667085",fontSize:"14px",lineHeight:"1.55"},
 label:{display:"block",marginBottom:"8px",color:"#344054",fontSize:"13px",fontWeight:"650",textAlign:"left"},
 required:{color:"#f97316"},
 input:{width:"100%",height:"50px",boxSizing:"border-box",padding:"0 15px",borderRadius:"11px",border:"1px solid #d9dee7",background:"#ffffff",color:"#172033",WebkitTextFillColor:"#172033",fontSize:"14px",outline:"none",colorScheme:"light"},
 button:{width:"100%",height:"52px",marginTop:"18px",border:"none",borderRadius:"11px",background:"linear-gradient(135deg,#f97316,#ea580c)",color:"#fff",fontWeight:"750",cursor:"pointer"},
 back:{marginTop:"20px",border:"none",background:"transparent",color:"#ea580c",fontSize:"13px",fontWeight:"650",cursor:"pointer"},
 successIcon:{width:"48px",height:"48px",margin:"0 auto 16px",display:"grid",placeItems:"center",borderRadius:"50%",background:"#fff7ed",color:"#ea580c",fontSize:"24px",fontWeight:"800"}
};