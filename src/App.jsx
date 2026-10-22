import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from "react-router-dom";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const ADMIN_EMAILS = ["2ruth.rsa.official@gmail.com"];
const BUCKET = "kasi-media";

function notify(message) { window.alert(message); }
function money(value) { return `R${Number(value || 0).toLocaleString("en-ZA")}`; }
function slugify(value) { return String(value || "").trim().replace(/\s+/g, "-"); }
function youtubeId(value) {
  try {
    const u = new URL(value);
    if (u.hostname.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] || null;
    }
  } catch {}
  return null;
}

function VerifiedBadge({ size = 18 }) {
  return (
    <span title="Verified artist" className="inline-flex relative items-center justify-center" style={{ width: size, height: size }}>
      <span className="absolute inset-0 bg-[#39FF14] rounded-full blur-[4px] opacity-70 animate-pulse"></span>
      <span className="relative w-full h-full bg-gradient-to-br from-[#39FF14] to-[#00ff88] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(57,255,20,0.9)]">
        <span className="text-black font-black" style={{fontSize: size*0.62}}>✓</span>
      </span>
    </span>
  );
}
function AdminBadge() { return <span className="inline-flex items-center rounded-full bg-[#39FF14] text-black px-3 py-1 text-[10px] font-black">✦ ADMIN POST</span>; }

function HiddenAudioPlayer({ youtube_url, title="Music" }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(youtube_url);
  if (!id) return null;
  return (
    <div className="w-full bg-black border border-zinc-800 rounded-xl p-3 flex items-center gap-3 mt-2">
      <button onClick={() => setPlaying(!playing)} className="w-11 h-11 rounded-full bg-[#39FF14] text-black font-black">{playing ? "❚❚" : "▶"}</button>
      <div className="flex-1"><p className="text-white text-sm font-bold truncate">{title}</p><p className="text-[#39FF14] text-[10px] font-bold">AUDIO MODE - VIDEO HIDDEN</p></div>
      {playing && <div className="w-0 h-0 overflow-hidden"><iframe width="1" height="1" src={`https://www.youtube.com/embed/${id}?autoplay=1`} allow="autoplay"></iframe></div>}
    </div>
  );
}

function Header() {
  const [user, setUser] = useState(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user || null)); }, []);
  return <header className="flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto mb-8">
    <Link to="/" className="font-black text-xl">KASI-<span className="text-[#39FF14]">Link</span></Link>
    <nav className="flex flex-wrap gap-2 text-sm">
      {user && <Link to="/dashboard/settings" className="bg-zinc-900 px-4 py-2 rounded-full">My Profile</Link>}
      {user && <Link to="/create-post" className="bg-zinc-900 px-4 py-2 rounded-full">＋ Post</Link>}
      <Link to="/admin" className="bg-zinc-900 px-4 py-2 rounded-full">Admin</Link>
      {user ? <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }} className="bg-zinc-900 px-4 py-2 rounded-full">Log out</button> : <Link to="/auth" className="bg-[#39FF14] text-black px-4 py-2 rounded-full font-bold">Login / Join</Link>}
    </nav>
  </header>;
}

function ArtistCard({ artist }) {
  return <Link to={`/${slugify(artist.stage_name)}`} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 block">
    {artist.avatar_url ? <img src={artist.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover mb-3" /> : <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-black mb-3">{(artist.stage_name || "A")[0]}</div>}
    <h3 className="font-bold truncate flex items-center gap-1">{artist.stage_name} {artist.is_verified && <VerifiedBadge size={14} />}</h3>
    <p className="text-xs text-zinc-400">{artist.genre} · {artist.views || 0} views</p>
  </Link>;
}

function PostCard({ post, onChanged, ownerId, isAdmin = false }) {
  const [liked, setLiked] = useState(false); const [likes, setLikes] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => {
    const [{ count }, { data: auth }] = await Promise.all([
      supabase.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", post.id),
      supabase.auth.getUser()
    ]);
    if (count !== null) setLikes(count);
    if (auth.user) { const { data: row } = await supabase.from("post_likes").select("post_id").eq("post_id", post.id).eq("user_id", auth.user.id).maybeSingle(); setLiked(Boolean(row)); }
  })(); }, [post.id]);
  const toggleLike = async () => {
    const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return notify("Log in to like");
    setBusy(true);
    if (liked) { await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", auth.user.id); setLiked(false); setLikes(n=>Math.max(0,n-1)); }
    else { const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: auth.user.id }); if (!error || error.code==="23505") { setLiked(true); setLikes(n=>n+1); } }
    setBusy(false); onChanged?.();
  };
  return <article className={`bg-zinc-900 border rounded-2xl p-4 ${post.is_admin_post ? "border-[#39FF14] shadow-[0_0_15px_rgba(57,255,20,0.2)]" : "border-zinc-800"}`}>
    <div className="flex justify-between"><span className="font-bold flex gap-1 items-center">{post.artists?.stage_name || post.author_name} {post.artists?.is_verified && <VerifiedBadge size={12}/>}</span>{post.is_admin_post && <AdminBadge/>}</div>
    <p className="text-xs text-zinc-500 mt-1">{post.created_at ? new Date(post.created_at).toLocaleString() : ""}</p>
    {post.content && <p className="whitespace-pre-wrap mt-3 text-sm">{post.content}</p>}
    {post.image_url && <img src={post.image_url} alt="" className="mt-3 rounded-xl w-full max-h-[500px] object-contain bg-black"/>}
    {post.youtube_url && <HiddenAudioPlayer youtube_url={post.youtube_url} title="Post Music"/>}
    <div className="flex gap-3 mt-3 pt-3 border-t border-zinc-800"><button disabled={busy} onClick={toggleLike} className={`text-sm font-bold px-3 py-1 rounded-full ${liked ? "bg-[#39FF14] text-black" : "bg-zinc-800"}`}>{liked ? "♥" : "♡"} Like · {likes}</button>{ownerId===post.user_id && <button onClick={async()=>{ if(confirm("Delete?")){ await supabase.from("posts").delete().eq("id",post.id); onChanged?.(); } }} className="text-xs text-red-400 ml-auto">Delete</button>}</div>
  </article>;
}

function Feed({ artistId=null, limit=30 }) {
  const [posts,setPosts]=useState([]); const [user,setUser]=useState(null); const [loading,setLoading]=useState(true); const [r,setR]=useState(0);
  useEffect(()=>{ supabase.auth.getUser().then(({data})=>setUser(data.user)); },[]);
  useEffect(()=>{ (async()=>{ setLoading(true); let q=supabase.from("posts").select("*, artists(stage_name,is_verified)").order("created_at",{ascending:false}).limit(limit); if(artistId) q=q.eq("artist_id",artistId); const {data}=await q; setPosts(data||[]); setLoading(false); })(); },[artistId,limit,r]);
  return <section className="space-y-4">{loading ? <p className="text-zinc-500 text-sm">Loading...</p> : posts.length===0 ? <p className="bg-zinc-900 rounded-xl p-5 text-sm text-zinc-500">No posts yet</p> : posts.map(p=><PostCard key={p.id} post={p} ownerId={user?.id} onChanged={()=>setR(v=>v+1)}/>)}</section>;
}

function Home() {
  const [artists,setArtists]=useState([]); const [search,setSearch]=useState(""); const [tab,setTab]=useState("feed");
  useEffect(()=>{ supabase.from("artists").select("*").order("created_at",{ascending:false}).then(({data})=>setArtists(data||[])); },[]);
  const filtered=useMemo(()=>artists.filter(a=>(a.stage_name||"").toLowerCase().includes(search.toLowerCase())),[artists,search]);
  return <main className="min-h-screen bg-black text-white p-5"><Header/><div className="max-w-6xl mx-auto">
    <section className="text-center py-10"><h1 className="text-5xl font-black">KASI-<span className="text-[#39FF14]">Link</span></h1><p className="text-zinc-500 mt-2">Brought to you by Tsa Qwaqwa Studios</p></section>
    <div className="flex gap-2 mb-5"><button onClick={()=>setTab("feed")} className={`px-4 py-2 rounded-full text-sm ${tab==="feed" ? "bg-[#39FF14] text-black font-bold" : "bg-zinc-900"}`}>Community feed</button><button onClick={()=>setTab("artists")} className={`px-4 py-2 rounded-full text-sm ${tab==="artists" ? "bg-[#39FF14] text-black font-bold" : "bg-zinc-900"}`}>Artists ({artists.length})</button></div>
    {tab==="feed" ? <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6"><div><Feed limit={40}/></div><aside><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search artists..." className="w-full p-3 mb-3 rounded-xl bg-zinc-900 border border-zinc-800"/><div className="grid grid-cols-1 gap-3">{filtered.slice(0,6).map(a=><ArtistCard key={a.id} artist={a}/>)}</div></aside></div> : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">{filtered.map(a=><ArtistCard key={a.id} artist={a}/>)}</div>}
  </div></main>;
}

function Auth(){ const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [signup,setSignup]=useState(false); const nav=useNavigate(); const [busy,setBusy]=useState(false); const handle=async()=>{ if(!email.trim()||password.length<6) return notify("Enter valid email + 6 chars password"); setBusy(true); if(signup){ const {data,error}=await supabase.auth.signUp({email:email.trim(),password}); if(error){setBusy(false);return notify(error.message);} if(data.user&&data.session){notify("Account created"); nav("/onboard");} else notify("Check email"); } else { const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password}); if(error) notify(error.message); else nav("/"); } setBusy(false); }; return <div className="min-h-screen bg-black text-white flex items-center justify-center p-5"><div className="bg-zinc-900 p-8 rounded-3xl w-full max-w-md"><Link to="/" className="font-black">KASI-<span className="text-[#39FF14]">Link</span></Link><h2 className="text-2xl font-black mt-5">{signup?"Join":"Welcome back"}</h2><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full p-3 mt-3 rounded-xl bg-black border border-zinc-700"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full p-3 mt-3 rounded-xl bg-black border border-zinc-700"/><button disabled={busy} onClick={handle} className="w-full mt-4 bg-[#39FF14] text-black p-3 rounded-full font-bold">{busy?"Wait...":signup?"Create account":"Login"}</button><button onClick={()=>setSignup(v=>!v)} className="w-full mt-3 bg-zinc-800 p-3 rounded-full text-sm">{signup?"Have account? Login":"New? Sign up"}</button></div></div>; }

function CreatePost(){ const [content,setContent]=useState(""); const [file,setFile]=useState(null); const [yt,setYt]=useState(""); const [busy,setBusy]=useState(false); const nav=useNavigate(); const submit=async()=>{ const {data:{user}}=await supabase.auth.getUser(); if(!user) return nav("/auth"); if(!content.trim()&&!file) return notify("Write something"); setBusy(true); const {data:artist}=await supabase.from("artists").select("id,stage_name").eq("user_id",user.id).maybeSingle(); let image_url=null; if(file){ const path=`${user.id}/${Date.now()}-${file.name}`; const {error}=await supabase.storage.from(BUCKET).upload(path,file); if(error){setBusy(false);return notify(error.message);} image_url=supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; } const isAdmin=ADMIN_EMAILS.includes((user.email||"").toLowerCase()); const {error}=await supabase.from("posts").insert({user_id:user.id, artist_id:artist?.id||null, author_name:artist?.stage_name||user.email, content:content.trim(), image_url, youtube_url:yt||null, is_admin_post:isAdmin}); setBusy(false); if(error) notify(error.message); else {notify("Posted!"); nav("/");} }; return <div className="min-h-screen bg-black text-white p-5"><div className="max-w-2xl mx-auto"><Header/><div className="bg-zinc-900 rounded-2xl p-6"><h1 className="text-2xl font-black">Create Post</h1><textarea value={content} onChange={e=>setContent(e.target.value)} rows={5} placeholder="What's happening?" className="w-full p-4 mt-3 rounded-xl bg-black border border-zinc-700"/><input value={yt} onChange={e=>setYt(e.target.value)} placeholder="YouTube Music URL - plays as hidden audio player" className="w-full p-3 mt-3 rounded-xl bg-black border border-[#39FF14]/40"/><input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)} className="block w-full mt-3 text-sm"/><button disabled={busy} onClick={submit} className="w-full mt-5 bg-[#39FF14] text-black p-3 rounded-full font-bold">{busy?"Publishing...":"Publish"}</button></div></div></div>; }

function ArtistPage(){ const {username}=useParams(); const [artist,setArtist]=useState(null); const [tracks,setTracks]=useState([]); const [stats,setStats]=useState({likes:0,plays:0,views:0}); useEffect(()=>{ (async()=>{ const clean=decodeURIComponent(username||"").replace(/-/g," "); let {data}=await supabase.from("artists").select("*").ilike("stage_name",clean).maybeSingle(); if(!data){ const r=await supabase.from("artists").select("*").ilike("stage_name",username).maybeSingle(); data=r.data; } if(!data) return; setArtist(data); await supabase.from("artist_views").insert({artist_id:data.id}); const {data:trackRows}=await supabase.from("artist_tracks").select("*").eq("artist_id",data.id).order("created_at",{ascending:false}).limit(50); setTracks(trackRows||[]); const [{count:likes},{count:plays},{count:views}]=await Promise.all([supabase.from("post_likes").select("post_id, posts!inner(artist_id)",{count:"exact",head:true}).eq("posts.artist_id",data.id), supabase.from("music_events").select("id",{count:"exact",head:true}).eq("artist_id",data.id), supabase.from("artist_views").select("id",{count:"exact",head:true}).eq("artist_id",data.id)]); setStats({likes:likes||0,plays:plays||0,views:views||0}); })(); },[username]); if(!artist) return <div className="min-h-screen bg-black text-white p-8"><Header/><p>Loading...</p></div>; const links=[["YouTube",artist.youtube_url],["Spotify",artist.spotify_url],["Apple Music",artist.apple_music_url],["SoundCloud",artist.soundcloud_url],["TikTok",artist.tiktok_url],["Instagram",artist.instagram_url]].filter(x=>x[1]); return <div className="min-h-screen bg-black text-white p-5"><div className="max-w-5xl mx-auto"><Header/><div className="h-40 bg-zinc-900 rounded-2xl overflow-hidden">{artist.banner_url ? <img src={artist.banner_url} alt="" className="w-full h-full object-cover"/> : <div className="h-full flex items-center justify-center text-zinc-600">KASI-Link</div>}</div><div className="px-5"><div className="-mt-10 w-24 h-24 rounded-full border-4 border-black bg-zinc-800 overflow-hidden flex items-center justify-center text-3xl font-black">{artist.avatar_url ? <img src={artist.avatar_url} alt="" className="w-full h-full object-cover"/> : (artist.stage_name||"A")[0]}</div><h1 className="text-3xl font-black mt-3 flex items-center gap-2">{artist.stage_name} {artist.is_verified && <VerifiedBadge size={22}/>}</h1><p className="text-zinc-400">{artist.genre} · 📍 {artist.location}</p><p className="text-zinc-300 mt-4 whitespace-pre-wrap">{artist.bio}</p><div className="flex flex-wrap gap-2 mt-4">{links.map(([l,u])=><a key={l} href={u} target="_blank" rel="noreferrer" className="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-full text-sm hover:border-[#39FF14]">{l} ↗</a>)}</div><div className="grid grid-cols-3 gap-3 mt-6"><div className="bg-zinc-900 p-4 rounded-xl"><p className="text-xs text-zinc-500">Views</p><p className="text-xl font-black">{artist.views||stats.views}</p></div><div className="bg-zinc-900 p-4 rounded-xl"><p className="text-xs text-zinc-500">Likes</p><p className="text-xl font-black">{stats.likes}</p></div><div className="bg-zinc-900 p-4 rounded-xl"><p className="text-xs text-zinc-500">Plays</p><p className="text-xl font-black">{stats.plays}</p></div></div>{artist.youtube_url && <div className="mt-6"><h3 className="font-bold mb-2">Featured Music - Audio Player</h3><HiddenAudioPlayer youtube_url={artist.youtube_url} title={artist.stage_name+" Featured"}/></div>}<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10"><section><h2 className="text-xl font-black mb-4">Music ({tracks.length}/50 - Audio Only)</h2>{tracks.length ? <div className="space-y-3">{tracks.map(t=>{ const [p,setP]=useState(false); return <div key={t.id} className="bg-zinc-900 p-3 rounded-xl border border-zinc-800"><div className="flex justify-between"><p className="font-bold text-sm truncate">{t.title}</p><button onClick={()=>{ setP(!p); if(!p) supabase.from("music_events").insert({artist_id:artist.id}); }} className="bg-[#39FF14] text-black px-4 py-1 rounded-full text-sm font-bold">{p?"Pause":"Play"}</button></div>{p && <HiddenAudioPlayer youtube_url={t.youtube_url} title={t.title}/>}</div>})}</div> : <p className="bg-zinc-900 p-4 rounded-xl text-sm text-zinc-500">No music yet</p>}</section><section><h2 className="text-xl font-black mb-4">Posts</h2><Feed artistId={artist.id}/></section></div></div></div></div>; }

function Settings() {
  const [user,setUser]=useState(null); const [form,setForm]=useState(null); const [tracks,setTracks]=useState([]); const [title,setTitle]=useState(""); const [url,setUrl]=useState(""); const [busy,setBusy]=useState(false); const nav=useNavigate();
  useEffect(()=>{ (async()=>{ const {data:{user:u}}=await supabase.auth.getUser(); if(!u) return nav("/auth"); setUser(u); const {data:a}=await supabase.from("artists").select("*").eq("user_id",u.id).maybeSingle(); if(a){ setForm({...a,booking_price:a.booking_price||0}); const {data:t}=await supabase.from("artist_tracks").select("*").eq("artist_id",a.id).order("created_at",{ascending:false}).limit(50); setTracks(t||[]); } else setForm({stage_name:"",genre:"Hip Hop",location:"",bio:"",whatsapp:"",booking_price:0,avatar_url:"",banner_url:"",youtube_url:"",spotify_url:"",apple_music_url:"",soundcloud_url:"",tiktok_url:"",instagram_url:""}); })(); },[]);
  const save=async()=>{ if(!form?.stage_name?.trim()) return notify("Stage name required"); setBusy(true); const payload={stage_name:form.stage_name,genre:form.genre,location:form.location,bio:form.bio,whatsapp:form.whatsapp,booking_price:Math.max(0,parseInt(form.booking_price,10)||0),avatar_url:form.avatar_url,banner_url:form.banner_url,youtube_url:form.youtube_url,spotify_url:form.spotify_url,apple_music_url:form.apple_music_url,soundcloud_url:form.soundcloud_url,tiktok_url:form.tiktok_url,instagram_url:form.instagram_url}; const {data:existing}=await supabase.from("artists").select("id").eq("user_id",user.id).maybeSingle(); const res=existing?await supabase.from("artists").update(payload).eq("user_id",user.id):await supabase.from("artists").insert({...payload,user_id:user.id,views:0,is_verified:false}); setBusy(false); if(res.error) notify(res.error.message); else notify("Saved with YouTube & all platforms!"); };
  const addTrack=async()=>{ const {data:a}=await supabase.from("artists").select("id").eq("user_id",user.id).maybeSingle(); if(!a) return notify("Save profile first"); if(tracks.length>=50) return notify("Max 50"); if(!title.trim()||!youtubeId(url)) return notify("Enter title + valid YouTube URL"); const {data,error}=await supabase.from("artist_tracks").insert({artist_id:a.id,user_id:user.id,title:title.trim(),youtube_url:url.trim()}).select().single(); if(error) notify(error.message); else {setTracks(t=>[data,...t]); setTitle(""); setUrl("");} };
  if(!user||!form) return <div className="min-h-screen bg-black text-white p-8">Loading...</div>;
  return <div className="min-h-screen bg-black text-white p-5"><div className="max-w-3xl mx-auto"><Header/><h1 className="text-2xl font-black">Artist Settings - YouTube & All Platforms</h1>
    <div className="bg-zinc-900 p-5 rounded-2xl mt-5 space-y-3">
      <label className="block text-sm">Stage Name *<input value={form.stage_name||""} onChange={e=>setForm({...form,stage_name:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      <label className="block text-sm">Genre<input value={form.genre||""} onChange={e=>setForm({...form,genre:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      <label className="block text-sm">Location<input value={form.location||""} onChange={e=>setForm({...form,location:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      <label className="block text-sm">Bio<textarea rows={4} value={form.bio||""} onChange={e=>setForm({...form,bio:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      <label className="block text-sm">WhatsApp<input value={form.whatsapp||""} onChange={e=>setForm({...form,whatsapp:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      <label className="block text-sm">Booking Price R<input type="number" value={form.booking_price||0} onChange={e=>setForm({...form,booking_price:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      
      <div className="border-t border-[#39FF14]/20 pt-4">
        <p className="font-black text-[#39FF14] mb-3">--- YOUTUBE & ALL PLATFORM URLS ---</p>
        <label className="block text-sm">YouTube Channel / Music URL (Plays as hidden audio)<input value={form.youtube_url||""} onChange={e=>setForm({...form,youtube_url:e.target.value})} placeholder="https://youtube.com/watch?v=..." className="w-full mt-1 p-3 rounded-xl bg-black border border-[#39FF14]"/></label>
        <label className="block text-sm mt-2">Spotify URL<input value={form.spotify_url||""} onChange={e=>setForm({...form,spotify_url:e.target.value})} placeholder="https://open.spotify.com/..." className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
        <label className="block text-sm mt-2">Apple Music URL<input value={form.apple_music_url||""} onChange={e=>setForm({...form,apple_music_url:e.target.value})} placeholder="https://music.apple.com/..." className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
        <label className="block text-sm mt-2">SoundCloud URL<input value={form.soundcloud_url||""} onChange={e=>setForm({...form,soundcloud_url:e.target.value})} placeholder="https://soundcloud.com/..." className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
        <label className="block text-sm mt-2">TikTok URL<input value={form.tiktok_url||""} onChange={e=>setForm({...form,tiktok_url:e.target.value})} placeholder="https://tiktok.com/..." className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
        <label className="block text-sm mt-2">Instagram URL<input value={form.instagram_url||""} onChange={e=>setForm({...form,instagram_url:e.target.value})} placeholder="https://instagram.com/..." className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      </div>

      <label className="block text-sm">Avatar URL<input value={form.avatar_url||""} onChange={e=>setForm({...form,avatar_url:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      <label className="block text-sm">Banner URL<input value={form.banner_url||""} onChange={e=>setForm({...form,banner_url:e.target.value})} className="w-full mt-1 p-3 rounded-xl bg-black border border-zinc-700"/></label>
      <button disabled={busy} onClick={save} className="w-full mt-4 bg-[#39FF14] text-black p-3 rounded-full font-bold">{busy?"Saving...":"Save Profile With All Links"}</button>
    </div>
    <div className="bg-zinc-900 p-5 rounded-2xl mt-5">
      <h2 className="font-bold">Add Songs (up to 50) - Plays as hidden audio player</h2>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Track title" className="w-full mt-3 p-3 rounded-xl bg-black border border-zinc-700"/>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="YouTube URL - will play as audio only" className="w-full mt-2 p-3 rounded-xl bg-black border border-zinc-700"/>
      <button onClick={addTrack} className="mt-3 bg-[#39FF14] text-black px-5 py-2 rounded-full font-bold">Add Track</button>
      <div className="space-y-2 mt-4">{tracks.map(t=><div key={t.id} className="flex justify-between bg-black p-3 rounded-xl"><span className="text-sm truncate">{t.title}</span><button onClick={async()=>{ await supabase.from("artist_tracks").delete().eq("id",t.id); setTracks(v=>v.filter(x=>x.id!==t.id)); }} className="text-red-400 text-xs">Remove</button></div>)}</div>
    </div>
  </div></div>;
}

function Admin(){ const [user,setUser]=useState(null); const [isAdmin,setIsAdmin]=useState(false); const [artists,setArtists]=useState([]); useEffect(()=>{ (async()=>{ const {data:{user:u}}=await supabase.auth.getUser(); if(!u) return; setUser(u); setIsAdmin(ADMIN_EMAILS.includes((u.email||"").toLowerCase())); const {data}=await supabase.from("artists").select("*").order("created_at",{ascending:false}); setArtists(data||[]); })(); },[]); const toggleVerify=async(a)=>{ const {error}=await supabase.from("artists").update({is_verified:!a.is_verified}).eq("id",a.id); if(!error) setArtists(list=>list.map(x=>x.id===a.id?{...x,is_verified:!a.is_verified}:x)); }; if(!user) return <div className="bg-black text-white p-10">Loading...</div>; if(!isAdmin) return <div className="bg-black text-white p-10"><Header/><h1>Access denied</h1></div>; return <div className="min-h-screen bg-black text-white p-5"><div className="max-w-6xl mx-auto"><Header/><h1 className="text-3xl font-black text-[#39FF14]">ADMIN</h1><div className="grid grid-cols-3 gap-3 mt-6"><div className="bg-zinc-900 p-4 rounded-xl">Artists <p className="text-2xl font-black">{artists.length}</p></div><div className="bg-zinc-900 p-4 rounded-xl">Verified <p className="text-2xl font-black text-[#39FF14]">{artists.filter(a=>a.is_verified).length}</p></div><div className="bg-zinc-900 p-4 rounded-xl">Views <p className="text-2xl font-black">{artists.reduce((s,a)=>s+Number(a.views||0),0)}</p></div></div><div className="space-y-2 mt-4">{artists.map(a=><div key={a.id} className="bg-zinc-900 p-3 rounded-xl flex justify-between items-center"><span className="flex items-center gap-1"><b>{a.stage_name}</b> {a.is_verified && <VerifiedBadge size={12}/>}</span><button onClick={()=>toggleVerify(a)} className="bg-[#39FF14] text-black px-3 py-2 rounded-full text-xs font-bold">{a.is_verified?"Unverify":"Verify"}</button></div>)}</div></div></div>; }

export default function App(){ return <BrowserRouter><Routes><Route path="/" element={<Home/>}/><Route path="/auth" element={<Auth/>}/><Route path="/create-post" element={<CreatePost/>}/><Route path="/admin" element={<Admin/>}/><Route path="/dashboard/settings" element={<Settings/>}/><Route path="/:username" element={<ArtistPage/>}/></Routes></BrowserRouter>; }