import { useEffect,useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const strong=p=>p.length>=8&&p.length<=64&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p);

function Eye({hidden}){return hidden?<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.9c5 0 8.7 3.7 10 7.1a11.8 11.8 0 0 1-3.1 4.5"/><path d="M6.2 6.2C4.4 7.5 3.2 9.4 2 12c1.3 3.4 5 7.1 10 7.1 1 0 2-.1 2.9-.4"/></svg>:<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.7"/></svg>}

function Field({label,value,setValue,show,setShow}){
 return <div style={s.group}><label style={s.label}>{label} <span style={s.required}>*</span></label><div style={s.wrap}><input type={show?"text":"password"} minLength={8} maxLength={64} value={value} onChange={e=>setValue(e.target.value)} placeholder={label} style={{...s.input,paddingRight:"50px"}}/><button type="button" onClick={()=>setShow(!show)} style={s.eye} aria-label={show?"Hide password":"Show password"}><Eye hidden={show}/></button></div></div>;
}

export default function ResetPassword(){
 const [ready,setReady]=useState(false),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[show,setShow]=useState(false),[showConfirm,setShowConfirm]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState("");
 const navigate=useNavigate();
 useEffect(()=>{
   let mounted=true;

   const cleanupRecoveryUrl=()=>{
     if(window.location.hash.includes("access_token=") || window.location.hash.includes("type=recovery")){
       window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
     }
   };

   const check=async()=>{
     const {data}=await supabase.auth.getSession();
     if(mounted)setReady(Boolean(data?.session));
     cleanupRecoveryUrl();
   };

   const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{
     if(event==="PASSWORD_RECOVERY" || session){
       setReady(true);
       cleanupRecoveryUrl();
     }
   });

   check();
   return()=>{mounted=false;listener?.subscription?.unsubscribe();};
 },[]);
 const submit=async e=>{
   e.preventDefault();
   if(!ready){setMessage("This reset link is invalid or has expired. Please request a new one.");return;}
   if(!strong(password)){setMessage("Password must be 8–64 characters and include uppercase, lowercase, number, and special character.");return;}
   if(password!==confirm){setMessage("Passwords do not match.");return;}
   setLoading(true);setMessage("");
   const {error}=await supabase.auth.updateUser({password});
   if(error)setMessage("Unable to update your password. Please request a new reset link.");
   else{await supabase.auth.signOut();navigate("/");}
   setLoading(false);
 };
 return <div className="cibo-login" style={s.container}><div style={s.overlay}/><main className="cibo-login-card" style={s.card}>
   <img src="/logo.png" alt="CIBO" style={s.logo}/><h1 style={s.title}>Create new password</h1><p style={s.subtitle}>Use a strong password to secure your account.</p>
   <form onSubmit={submit}><Field label="New password" value={password} setValue={setPassword} show={show} setShow={setShow}/><Field label="Confirm password" value={confirm} setValue={setConfirm} show={showConfirm} setShow={setShowConfirm}/>{message&&<p style={s.message}>{message}</p>}<button type="submit" style={s.button} disabled={loading}>{loading?"Updating...":"Update password"}</button></form>
   <button type="button" onClick={()=>navigate("/")} style={s.back}>← Back to login</button>
 </main></div>;
}
const s={container:{minHeight:"100dvh",width:"100%",backgroundImage:"url('/bg.jpg')",backgroundSize:"cover",backgroundPosition:"center",display:"flex",alignItems:"center",justifyContent:"center",padding:"28px 20px",boxSizing:"border-box",position:"relative"},overlay:{position:"fixed",inset:0,background:"linear-gradient(135deg,rgba(15,23,42,.72),rgba(15,23,42,.52) 45%,rgba(249,115,22,.18))"},card:{position:"relative",zIndex:1,width:"min(430px,100%)",boxSizing:"border-box",background:"rgba(255,255,255,.97)",padding:"38px 42px 30px",borderRadius:"24px",boxShadow:"0 28px 70px rgba(0,0,0,.28)",textAlign:"center"},logo:{width:"72px",height:"72px",objectFit:"contain",borderRadius:"14px",marginBottom:"22px"},title:{margin:"0 0 9px",color:"#172033",fontSize:"28px",lineHeight:"1.2",fontWeight:"750"},subtitle:{margin:"0 0 24px",color:"#667085",fontSize:"14px",lineHeight:"1.55"},group:{marginBottom:"17px",textAlign:"left"},label:{display:"block",marginBottom:"8px",color:"#344054",fontSize:"13px",fontWeight:"650"},required:{color:"#f97316"},wrap:{position:"relative"},input:{width:"100%",height:"50px",boxSizing:"border-box",padding:"0 15px",borderRadius:"11px",border:"1px solid #d9dee7",background:"#ffffff",color:"#000000",WebkitTextFillColor:"#000000",colorScheme:"light",fontSize:"14px",outline:"none"},eye:{position:"absolute",top:"50%",right:"7px",transform:"translateY(-50%)",width:"38px",height:"38px",display:"grid",placeItems:"center",border:"none",borderRadius:"8px",background:"transparent",color:"#667085",cursor:"pointer",padding:0},message:{margin:"0 0 14px",padding:"10px 12px",borderRadius:"9px",background:"#fff7ed",color:"#c2410c",fontSize:"12px",lineHeight:"1.45",textAlign:"left"},button:{width:"100%",height:"52px",border:"none",borderRadius:"11px",background:"linear-gradient(135deg,#f97316,#ea580c)",color:"#fff",fontWeight:"750",cursor:"pointer"},back:{marginTop:"20px",border:"none",background:"transparent",color:"#ea580c",fontSize:"13px",fontWeight:"650",cursor:"pointer"}};