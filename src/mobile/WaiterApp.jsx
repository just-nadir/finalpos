import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
    Users, Clock, ChevronLeft, ShoppingBag, Plus, Minus, 
    CheckCircle, X, LogOut, User, AlertTriangle, Lock, 
    UtensilsCrossed, ChefHat 
} from 'lucide-react';

import { useSocketData } from '../hooks/useSocketData';
import { useCart } from '../hooks/useCart';
import { useMenu } from '../hooks/useMenu';
import MobilePinLogin from './MobilePinLogin'; 
import ConfirmModal from '../components/ConfirmModal';


const WaiterApp = () => {
  const [user, setUser] = useState(null); 
  const [view, setView] = useState('tables');
  const [filterMode, setFilterMode] = useState('all');
  const [activeTable, setActiveTable] = useState(null);
  
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestCount, setGuestCount] = useState(CONFIG.DEFAULT_GUEST_COUNT); 

  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [toast, setToast] = useState(null); 
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const { tables, loadTables, API_URL } = useSocketData();
  const { cart, addToCart, removeFromCart, clearCart, cartTotal, cartCount } = useCart();
  const { categories, products, activeCategory, setActiveCategory, loading: menuLoading, loadMenu } = useMenu(API_URL);

  useEffect(() => {
      if(toast) {
          const timer = setTimeout(() => setToast(null), CONFIG.TOAST_DURATION);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  if (!user) {
    return <MobilePinLogin apiUrl={API_URL} onLogin={(u) => setUser(u)} />;
  }

  const handleLogout = useCallback(() => {
      setUser(null);
      setView('tables');
      setShowConfirmLogout(false);
      clearCart();
  }, [clearCart]);

  const handleTableClick = useCallback((table) => {
    if (table.status === CONFIG.TABLE_STATUS.FREE) {
        setActiveTable(table);
        setGuestCount(CONFIG.DEFAULT_GUEST_COUNT); 
        setShowGuestModal(true);
        return;
    }
    
    if (table.waiter_id && table.waiter_id !== user.id) {
        setToast({ type: 'error', msg: `Bu stolga ${table.waiter_name} xizmat ko'rsatmoqda!` });
        return;
    }

    setActiveTable(table);
    openMenu(table);
  }, [user]);

  const confirmGuestCount = useCallback(() => {
    if (!activeTable) return;
    const updatedTable = { ...activeTable, guests: guestCount };
    setActiveTable(updatedTable);
    openMenu(updatedTable);
    setShowGuestModal(false);
  }, [activeTable, guestCount]);

  const openMenu = useCallback((table) => {
    clearCart();
    setView('menu');
    loadMenu();
  }, [clearCart, loadMenu]);

  const sendOrder = useCallback(async () => {
    if (!activeTable || cart.length === 0 || submittingOrder) return;
    
    setSubmittingOrder(true);
    try {
      await axios.post(`${API_URL}/tables/guests`, {
          tableId: activeTable.id,
          count: activeTable.guests 
      });

      await axios.post(`${API_URL}/orders/bulk-add`, {
          tableId: activeTable.id,
          items: cart,
          waiterId: user.id
      });
      
      setToast({ type: 'success', msg: "Buyurtma oshxonaga ketdi!" });
      clearCart();
      setView('tables');
      setActiveTable(null);
      loadTables();
    } catch (err) {
      console.error('Buyurtma yuborishda xato:', err);
      setToast({ type: 'error', msg: err.response?.data?.error || ERROR_MESSAGES.NETWORK_ERROR });
    } finally {
      setSubmittingOrder(false);
      setShowConfirmOrder(false);
    }
  }, [activeTable, cart, user, API_URL, clearCart, loadTables, submittingOrder]);

  // OPTIMIZED: useMemo for filtered tables
  const { myTables, freeTables, displayedTables } = useMemo(() => {
    const my = tables.filter(t => t.waiter_id === user.id && t.status !== CONFIG.TABLE_STATUS.FREE);
    const free = tables.filter(t => t.status === CONFIG.TABLE_STATUS.FREE);
    
    let displayed = tables;
    if (filterMode === 'mine') displayed = my;
    if (filterMode === 'free') displayed = free;

    return { myTables: my, freeTables: free, displayedTables: displayed };
  }, [tables, filterMode, user]);

  const GuestModal = () => {
      if (!showGuestModal) return null;
      return (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative">
                  <button onClick={() => setShowGuestModal(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500">
                    <X size={24}/>
                  </button>
                  <h2 className="text-2xl font-black text-gray-800 text-center mb-6">Mehmonlar soni</h2>
                  
                  <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4 mb-8 border-2 border-gray-100">
                      <button 
                        onClick={() => setGuestCount(Math.max(1, guestCount - 1))} 
                        className="w-16 h-16 bg-white rounded-xl shadow-sm text-4xl font-bold text-gray-400 active:text-blue-600 active:scale-90 flex items-center justify-center border border-gray-200"
                      >
                        -
                      </button>
                      <span className="text-6xl font-black text-gray-800 w-24 text-center">{guestCount}</span>
                      <button 
                        onClick={() => setGuestCount(Math.min(CONFIG.MAX_GUEST_COUNT, guestCount + 1))} 
                        className="w-16 h-16 bg-blue-600 rounded-xl shadow-lg shadow-blue-200 text-4xl font-bold text-white active:scale-90 flex items-center justify-center"
                      >
                        +
                      </button>
                  </div>

                  <button 
                    onClick={confirmGuestCount} 
                    className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold text-xl shadow-xl active:scale-95 flex items-center justify-center gap-2"
                  >
                      Davom etish <ChevronLeft className="rotate-180" />
                  </button>
              </div>
          </div>
      )
  };

  if (view === 'tables') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 relative font-sans">
        <GuestModal />
        
        {toast && (
            <div className={`fixed top-6 left-4 right-4 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold flex items-center gap-3 animate-in slide-in-from-top duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
                {toast.type === 'success' ? <CheckCircle size={24}/> : <AlertTriangle size={24}/>} 
                <span className="text-lg">{toast.msg}</span>
            </div>
        )}

        <ConfirmModal 
          isOpen={showConfirmLogout} 
          onClose={() => setShowConfirmLogout(false)} 
          onConfirm={handleLogout} 
          title="Chiqish" 
          message="Tizimdan chiqmoqchimisiz?" 
          confirmText="Ha, chiqish" 
        />

        <div className="bg-white px-6 pt-12 pb-4 sticky top-0 z-10 shadow-sm border-b border-gray-100 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                Salom, {user.name} 👋
            </h1>
            <p className="text-sm text-gray-400 font-medium mt-1">Yaxshi ish kuni tilayman!</p>
          </div>
          <button 
            onClick={() => setShowConfirmLogout(true)} 
            className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 active:bg-red-50 active:text-red-500 transition-colors"
          >
              <LogOut size={22}/>
          </button>
        </div>

        <div className="px-4 py-4 flex gap-3 overflow-x-auto scrollbar-hide">
             <button 
               onClick={() => setFilterMode('all')} 
               className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${filterMode === 'all' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-500 shadow-sm'}`}
             >
                 Hammasi ({tables.length})
             </button>
             <button 
               onClick={() => setFilterMode('mine')} 
               className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${filterMode === 'mine' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-gray-500 shadow-sm'}`}
             >
                 <User size={16}/> Meniki ({myTables.length})
             </button>
             <button 
               onClick={() => setFilterMode('free')} 
               className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${filterMode === 'free' ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-white text-gray-500 shadow-sm'}`}
             >
                 Bo'sh ({freeTables.length})
             </button>
        </div>

        <div className="px-4 grid grid-cols-2 gap-4 pb-20">
          {displayedTables.map(table => {
            const isMine = table.waiter_id === user.id && table.status !== CONFIG.TABLE_STATUS.FREE;
            const isBusyOther = table.status !== CONFIG.TABLE_STATUS.FREE && table.waiter_id !== user.id;
            const isFree = table.status === CONFIG.TABLE_STATUS.FREE;

            return (
                <div 
                  key={table.id} 
                  onClick={() => handleTableClick(table)}
                  className={`relative p-5 rounded-3xl flex flex-col justify-between h-40 transition-all shadow-sm border-2
                    ${isMine ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200 shadow-xl active:scale-95' : 
                      isBusyOther ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed' : 
                      'bg-white border-transparent shadow-md active:scale-95'}`}
                  style={isBusyOther ? { pointerEvents: 'none' } : {}}
                >
                  {isBusyOther && (
                    <div className="absolute top-4 right-4 text-gray-400">
                      <Lock size={20}/>
                    </div>
                  )}
                  
                  <div>
                     <h3 className={`font-black text-xl mb-1 ${isMine ? 'text-white' : 'text-gray-800'}`}>
                       {table.name}
                     </h3>
                     
                     {isBusyOther && table.waiter_name && (
                         <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-md inline-block mb-2">
                             {table.waiter_name}
                         </span>
                     )}

                     <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg tracking-wider
                       ${isMine ? 'bg-white/20 text-white' : 
                         isBusyOther ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                       {isFree ? 'BO\'SH' : isBusyOther ? 'BAND' : 'MENIKI'}
                     </span>
                  </div>

                  <div className="flex items-end justify-between">
                     <div className={`text-xs font-bold flex items-center gap-1 ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                        <Users size={16} /> {table.guests}
                     </div>
                     {!isFree && (
                         <div className={`font-black text-lg ${isMine ? 'text-white' : 'text-gray-900'}`}>
                             {table.total_amount?.toLocaleString()}
                         </div>
                     )}
                  </div>

                  {table.current_check_number > 0 && (
                      <div className={`absolute top-0 right-0 px-3 py-1.5 rounded-bl-2xl rounded-tr-2xl text-xs font-black
                          ${isMine ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          #{table.current_check_number}
                      </div>
                  )}
                </div>
            )
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden relative font-sans">
      <GuestModal />
      <ConfirmModal 
        isOpen={showConfirmOrder} 
        onClose={() => setShowConfirmOrder(false)} 
        onConfirm={sendOrder} 
        title="Tasdiqlash" 
        message={`Jami: ${cartTotal.toLocaleString()} so'm`} 
        confirmText={submittingOrder ? "Yuborilmoqda..." : "Yuborish"}
        isDanger={false} 
      />

      <div className="bg-white px-4 pt-10 pb-4 shadow-sm border-b flex items-center gap-4 z-20 sticky top-0">
        <button 
          onClick={() => setView('tables')} 
          className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all text-gray-700"
        >
            <ChevronLeft size={28} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
              <h2 className="font-black text-xl text-gray-900 leading-none">{activeTable?.name}</h2>
              {activeTable?.current_check_number > 0 && (
                  <span className="text-xs font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    #{activeTable.current_check_number}
                  </span>
              )}
          </div>
          <div className="text-xs text-blue-600 font-bold mt-1 flex items-center gap-1">
             <Users size={12}/> {activeTable?.guests} mehmon
          </div>
        </div>
        
        <button 
          onClick={() => setView(view === 'cart' ? 'menu' : 'cart')} 
          className={`p-3 rounded-2xl relative transition-all active:scale-95 ${view === 'cart' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-600'}`}
        >
           <ShoppingBag size={24} />
           {cartCount > 0 && (
             <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
               {cartCount}
             </span>
           )}
        </button>
      </div>

      {view === 'cart' ? (
        <div className="flex-1 overflow-y-auto p-5 pb-40">
           <h2 className="font-black text-2xl mb-6 text-gray-900">Savatcha</h2>
           {cart.length === 0 ? (
               <div className="flex flex-col items-center justify-center mt-20 text-gray-300">
                   <ShoppingBag size={64} className="mb-4 opacity-20"/>
                   <p className="font-bold">Hali hech narsa tanlanmadi</p>
               </div>
           ) : (
             <div className="space-y-4">
               {cart.map(item => (
                 <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border border-gray-100">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
                        <p className="text-blue-600 font-bold">{item.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl">
                       <button 
                         onClick={() => removeFromCart(item.id)} 
                         className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-red-500 active:scale-90"
                       >
                         <Minus size={20}/>
                       </button>
                       <span className="font-black text-xl w-6 text-center">{item.qty}</span>
                       <button 
                         onClick={() => addToCart(item)} 
                         className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-green-500 active:scale-90"
                       >
                         <Plus size={20}/>
                       </button>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      ) : (
        <>
          <div className="bg-white pb-2 z-10">
            <div className="flex overflow-x-auto px-4 py-2 gap-3 scrollbar-hide">
              {categories.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${activeCategory === cat.id ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-40">
            {menuLoading ? (
              <div className="text-center py-10 text-gray-400">
                <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Yuklanmoqda...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {products.filter(p => p.category_id === activeCategory).map(product => {
                  const inCart = cart.find(c => c.id === product.id);
                  return (
                    <div 
                      key={product.id} 
                      onClick={() => addToCart(product)}
                      className={`p-4 rounded-3xl flex justify-between items-center transition-all active:scale-95 border-2 
                        ${inCart ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-transparent shadow-sm'}`}
                    >
                      <div className="flex items-center gap-4">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${inCart ? 'bg-blue-200' : 'bg-gray-100'}`}>
                            🍳
                         </div>
                         <div>
                             <h3 className="font-bold text-gray-900 text-lg">{product.name}</h3>
                             <p className="text-gray-500 font-medium">{product.price.toLocaleString()} so'm</p>
                         </div>
                      </div>
                      {inCart ? (
                          <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-lg shadow-blue-200">
                              {inCart.qty}
                          </div>
                      ) : (
                          <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                              <Plus size={24} />
                          </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white p-5 rounded-t-[2rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-30">
           <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-gray-400 font-bold">{cartCount} xil taom</span>
              <span className="text-2xl font-black text-gray-900">{cartTotal.toLocaleString()} so'm</span>
           </div>
           {view === 'cart' ? (
             <button 
               onClick={() => setShowConfirmOrder(true)}
               disabled={submittingOrder}
               className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold text-xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 disabled:opacity-50"
             >
                 <ChefHat size={24}/> {submittingOrder ? 'Yuborilmoqda...' : 'Buyurtma Berish'}
             </button>
           ) : (
             <button 
               onClick={() => setView('cart')} 
               className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-xl shadow-xl shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-3"
             >
                 Savatchaga O'tish
             </button>
           )}
        </div>
      )}
    </div>
  );
};

export default WaiterApp;