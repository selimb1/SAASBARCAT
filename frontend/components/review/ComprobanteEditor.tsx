"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import {
  Save, Check, AlertCircle, X, ChevronRight,
  Maximize2, Minimize2, Image as ImageIcon, Loader2
} from "lucide-react";
import { api } from "@/lib/api";

interface ComprobanteEditorProps {
  comprobante: any;
  onSaved: () => void;
}

export function ComprobanteEditor({ comprobante, onSaved }: ComprobanteEditorProps) {
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(false);
  
  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty } } = useForm({
    defaultValues: { ...comprobante }
  });

  // Watch key amounts to auto-calculate totals or highlight diffs
  const neto = Number(watch("importe_neto_gravado") || 0);
  const iva21 = Number(watch("iva_21") || 0);
  const iva105 = Number(watch("iva_105") || 0);
  const iva27 = Number(watch("iva_27") || 0);
  const exento = Number(watch("importe_exento") || 0);
  const noGrav = Number(watch("importe_no_gravado") || 0);
  const percs = Number(watch("importe_percepciones") || 0);
  const retenc = Number(watch("importe_retenciones") || 0);
  const totalDeclarado = Number(watch("importe_total") || 0);
  
  const totalCalculado = neto + iva21 + iva105 + iva27 + exento + noGrav + percs - retenc;
  const difImportes = Math.abs(totalCalculado - totalDeclarado) > 1.5;

  useEffect(() => {
    // Reset form when active comprobante changes
    let data = { ...comprobante };
    if (data.fecha_emision && data.fecha_emision.includes("-")) {
       // Convert YYYY-MM-DD to DD/MM/YYYY for display if needed, or keep YYYY-MM-DD for native date inputs
    }
    reset(data);
  }, [comprobante, reset]);

  const onSave = async (data: any, approve: boolean = false) => {
    if (approve) setApproving(true);
    else setLoading(true);

    try {
      const payload = {
        ...data,
        estado_revision: approve ? "aprobado" : data.estado_revision
      };
      
      // Clean up empty strings to null for backend numbers
      Object.keys(payload).forEach(k => {
         if (payload[k] === "") payload[k] = null;
      });

      await api.patch(`/comprobantes/${comprobante.id}`, payload);
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setApproving(false);
    }
  };

  const getConfIcon = (field: string) => {
    const confs = comprobante.confianza_por_campo || {};
    const val = confs[field];
    if (val === undefined || val === null) return null;
    
    let color = "bg-danger-500";
    if (val >= 0.85) color = "bg-success-500";
    else if (val >= 0.70) color = "bg-warning-500";
    
    return (
      <div 
        className={`w-1.5 h-1.5 rounded-full ${color} absolute right-3 top-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(0,0,0,0.5)]`} 
        title={`Confianza IA: ${Math.round(val * 100)}%`}
      />
    );
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      
      {/* Visualizador de imagen (Izquierda/Arriba) */}
      <div className={`
        ${fullscreenImage ? 'fixed inset-0 z-50 bg-black/95 p-8 flex flex-col' : 'w-full md:w-1/2 border-b md:border-b-0 md:border-r border-dark-800 bg-dark-900'} 
        transition-all duration-300 relative group
      `}>
         <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button 
              onClick={() => setFullscreenImage(!fullscreenImage)}
              className="bg-dark-950/80 hover:bg-dark-900 text-white p-2 rounded-lg backdrop-blur-md border border-white/10"
            >
              {fullscreenImage ? <Minimize2 className="w-5 h-5"/> : <Maximize2 className="w-5 h-5"/>}
            </button>
            {fullscreenImage && (
               <button 
                 onClick={() => setFullscreenImage(false)}
                 className="bg-danger-500/80 hover:bg-danger-500 text-white p-2 rounded-lg backdrop-blur-md"
               >
                 <X className="w-5 h-5"/>
               </button>
            )}
         </div>

         {comprobante.imagen_original_url ? (
            <div className="w-full h-full p-4 flex items-center justify-center overflow-auto">
              <img 
                src={comprobante.imagen_original_url} 
                alt="Comprobante" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
         ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-dark-600">
               <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
               <p>No hay imagen disponible</p>
            </div>
         )}
      </div>

      {/* Formulario de Datos (Derecha/Abajo) */}
      <div className={`flex flex-col bg-dark-950 ${fullscreenImage ? 'hidden' : 'w-full md:w-1/2'}`}>
        
        {/* Top bar alerts */}
        <div className="px-6 py-4 border-b border-dark-800 shrink-0 bg-dark-900/50 backdrop-blur-sm z-10">
          {(comprobante.alertas_validacion && comprobante.alertas_validacion.length > 0) ? (
            <div className="bg-warning-500/10 border border-warning-500/20 p-3 rounded-xl flex gap-3 text-warning-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">Revisión sugerida:</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  {comprobante.alertas_validacion.map((a: string, i: number) => <li key={i}>{a}</li>)}
                  {difImportes && <li>La suma de importes no coincide con el total.</li>}
                </ul>
              </div>
            </div>
          ) : (
             <div className="bg-success-500/10 border border-success-500/20 p-3 rounded-xl flex items-center gap-3 text-success-500 text-sm font-medium">
               <CheckCircle className="w-5 h-5 shrink-0" />
               Datos extraídos correctamente.
             </div>
          )}
        </div>

        {/* Form scroll area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <form className="space-y-8" id="comprobante-form">
            
            {/* Cabecera comprobante */}
            <div>
               <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-widest mb-4 border-b border-dark-800 pb-2">Cabecera</h3>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 <div className="relative">
                   <label className="label">Tipo</label>
                   <select {...register("tipo_comprobante")} className="input appearance-none bg-dark-900">
                      <option value="A">Factura A</option>
                      <option value="B">Factura B</option>
                      <option value="C">Factura C</option>
                      <option value="M">Factura M</option>
                      <option value="ND_A">Nota Débito A</option>
                      <option value="NC_A">Nota Crédito A</option>
                      <option value="ND_B">Nota Débito B</option>
                      <option value="NC_B">Nota Crédito B</option>
                      <option value="TICKET">Ticket / Otro</option>
                   </select>
                   {getConfIcon("tipo_comprobante")}
                 </div>
                 
                 <div className="relative">
                   <label className="label">Fecha</label>
                   <input type="date" {...register("fecha_emision")} className="input bg-dark-900" />
                   {getConfIcon("fecha_emision")}
                 </div>

                 <div className="col-span-2 md:col-span-1 grid grid-cols-3 gap-2">
                   <div className="col-span-1 relative">
                     <label className="label">PtoVta</label>
                     <input type="text" {...register("punto_venta")} className="input text-center" placeholder="0001" />
                   </div>
                   <div className="col-span-2 relative">
                     <label className="label">Número</label>
                     <input type="text" {...register("numero_comprobante")} className="input text-center font-mono" placeholder="12345678" />
                   </div>
                 </div>
               </div>
            </div>

            {/* Emisor */}
            <div>
               <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-widest mb-4 border-b border-dark-800 pb-2">Proveedor</h3>
               <div className="grid md:grid-cols-3 gap-4">
                 <div className="md:col-span-1 relative">
                   <label className="label">CUIT</label>
                   <input type="text" {...register("cuit_emisor")} className="input font-mono" placeholder="20-12345678-9" />
                   {getConfIcon("cuit_emisor")}
                 </div>
                 <div className="md:col-span-2 relative">
                   <label className="label">Razón Social</label>
                   <input type="text" {...register("razon_social_emisor")} className="input" />
                   {getConfIcon("razon_social_emisor")}
                 </div>
               </div>
            </div>

            {/* Importes */}
            <div>
               <div className="flex justify-between items-end mb-4 border-b border-dark-800 pb-2">
                 <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-widest">Importes</h3>
                 {difImportes && <span className="text-xs text-danger-500 font-bold bg-danger-500/20 px-2 py-0.5 rounded">Revisar sumatoria</span>}
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="relative">
                   <label className="label text-xs">Neto Gravado</label>
                   <input type="number" step="0.01" {...register("importe_neto_gravado")} className="input text-right font-mono" />
                   {getConfIcon("importe_neto_gravado")}
                 </div>
                 <div className="relative">
                   <label className="label text-xs">No Gravado</label>
                   <input type="number" step="0.01" {...register("importe_no_gravado")} className="input text-right font-mono" />
                 </div>
                 <div className="relative">
                   <label className="label text-xs">Exento</label>
                   <input type="number" step="0.01" {...register("importe_exento")} className="input text-right font-mono" />
                 </div>
                 
                 <div className="relative">
                   <label className="label text-xs text-brand-300">IVA 21%</label>
                   <input type="number" step="0.01" {...register("iva_21")} className="input text-right font-mono border-brand-500/30 bg-brand-500/5 focus:border-brand-500 focus:bg-brand-500/10" />
                   {getConfIcon("iva_21")}
                 </div>
                 <div className="relative">
                   <label className="label text-xs text-brand-300">IVA 10.5%</label>
                   <input type="number" step="0.01" {...register("iva_105")} className="input text-right font-mono border-brand-500/30 bg-brand-500/5 focus:border-brand-500 focus:bg-brand-500/10" />
                   {getConfIcon("iva_105")}
                 </div>
                 <div className="relative">
                   <label className="label text-xs text-brand-300">IVA 27%</label>
                   <input type="number" step="0.01" {...register("iva_27")} className="input text-right font-mono border-brand-500/30 bg-brand-500/5 focus:border-brand-500 focus:bg-brand-500/10" />
                 </div>

                 <div className="relative">
                   <label className="label text-xs text-warning-400">Percepciones</label>
                   <input type="number" step="0.01" {...register("importe_percepciones")} className="input text-right font-mono border-warning-500/30 bg-warning-500/5 focus:border-warning-500" />
                   {getConfIcon("importe_percepciones")}
                 </div>
                 <div className="relative">
                   <label className="label text-xs text-danger-400">Retenciones</label>
                   <input type="number" step="0.01" {...register("importe_retenciones")} className="input text-right font-mono border-danger-500/30 bg-danger-500/5 focus:border-danger-500" />
                 </div>

                 <div className="col-span-2 md:col-span-4 mt-2 p-4 bg-dark-900 rounded-xl border border-dark-700 flex justify-between items-center group">
                    <div className="text-dark-400 text-sm">
                       Sumatoria: <span className="font-mono text-dark-200">${totalCalculado.toFixed(2)}</span>
                    </div>
                    <div className="relative text-right w-1/2 md:w-1/3">
                      <label className={`label text-xs ${difImportes ? 'text-danger-400 font-bold' : 'text-success-400'}`}>TOTAL COMPROBANTE</label>
                      <input type="number" step="0.01" {...register("importe_total")} className={`input text-right font-mono font-bold text-lg ${difImportes ? 'border-danger-500 bg-danger-500/10 text-danger-400 focus:border-danger-400' : 'border-success-500/50 bg-success-500/10 text-success-400'}`} />
                      {getConfIcon("importe_total")}
                    </div>
                 </div>
               </div>
            </div>

            {/* AFIP / Otros */}
            <div>
               <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-widest mb-4 border-b border-dark-800 pb-2">Información Fiscal</h3>
               <div className="grid grid-cols-2 gap-4">
                 <div className="relative">
                   <label className="label">CAE</label>
                   <input type="text" {...register("cae")} className="input font-mono" placeholder="14 dígitos" />
                   {getConfIcon("cae")}
                 </div>
                 <div className="relative">
                   <label className="label">Condición Pago</label>
                   <select {...register("condicion_venta")} className="input appearance-none bg-dark-900">
                      <option value="CONTADO">Contado</option>
                      <option value="CUENTA_CORRIENTE">Cuenta Corriente</option>
                      <option value="CREDITO">Crédito</option>
                      <option value="OTRO">Otro</option>
                   </select>
                 </div>
               </div>
            </div>
            
            {/* Space at the bottom for scroll */}
            <div className="h-10"></div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-dark-800 bg-dark-900 shrink-0 flex items-center justify-between gap-4 z-10">
           {isDirty ? (
              <span className="text-sm text-warning-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Hay cambios sin guardar
              </span>
           ) : (
             <span className="text-sm text-dark-500">Comprobante ID: {comprobante.id.slice(0,6)}</span>
           )}

           <div className="flex gap-3">
             <button 
               type="button"
               disabled={loading || approving || !isDirty}
               onClick={handleSubmit((d) => onSave(d, false))}
               className="btn-secondary btn-md"
             >
               {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
               Guardar
             </button>
             
             <button 
               type="button"
               disabled={loading || approving || (comprobante.estado_revision === "aprobado" && !isDirty)}
               onClick={handleSubmit((d) => onSave(d, true))}
               className={`btn-md ${isDirty ? 'btn-primary' : 'btn-success'}`}
             >
               {approving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
               {isDirty ? 'Guardar y Aprobar' : (comprobante.estado_revision === "aprobado" ? 'Aprobado' : 'Aprobar')}
             </button>
           </div>
        </div>

      </div>
    </div>
  );
}
