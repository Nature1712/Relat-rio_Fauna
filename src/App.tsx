import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Check, MapPin, Shield, Info, Copy, Camera, Loader2, History, Clock, ChevronDown, ChevronUp, X, Download, Smartphone, Sparkles, Fingerprint, FileText } from 'lucide-react';
import { executeAICommand } from './services/ai';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type SolturaOption = 'HFAUS' | 'HVET/UNB' | 'MANUAL';

interface ReportData {
  vtr: string;
  latResgate: string;
  lonResgate: string;
  soltura: SolturaOption;
  localSolturaManual: string;
  latSoltura: string;
  lonSoltura: string;
  especie: string;
  quantidade: string;
  estagioVida: string;
  condicao: string;
  circunstancias: string;
}

interface HistoryItem {
  id: string;
  timestamp: string;
  text: string;
  especie: string;
  vtr: string;
}

const ai = null; // Removed top-level instantiation

const CERRADO_BACKGROUNDS = [
  '/cerrado_escuro.png',
  '/lobo_guara_negro.png',
  '/coruja_olhando_frente.png',
  '/tamandua_dia.png',
  '/sarue_cerrado.png',
  '/cerrado_background.png',
  'solid-black',
  '/onca_pintada.png'
];

export default function App() {
  const [data, setData] = useState<ReportData>({
    vtr: '',
    latResgate: '',
    lonResgate: '',
    soltura: 'HFAUS',
    localSolturaManual: '',
    latSoltura: '',
    lonSoltura: '',
    especie: '',
    quantidade: '1',
    estagioVida: 'Jovem',
    condicao: 'Debilitado',
    circunstancias: '',
  });

  const [bgIndex, setBgIndex] = useState<number>(() => {
    const promptVersion = "v13-onca-pintada";
    const savedVersion = localStorage.getItem('app_bg_version');
    if (savedVersion !== promptVersion) {
      localStorage.setItem('app_bg_version', promptVersion);
      localStorage.removeItem('app_bg');
      localStorage.removeItem('app_bg_index');
      return 0;
    }
    const saved = localStorage.getItem('app_bg_index');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [bgUrl, setBgUrl] = useState<string>(() => {
    const promptVersion = "v13-onca-pintada";
    const savedVersion = localStorage.getItem('app_bg_version');
    if (savedVersion !== promptVersion) {
      return CERRADO_BACKGROUNDS[0];
    }
    const savedBg = localStorage.getItem('app_bg');
    return savedBg ? savedBg : CERRADO_BACKGROUNDS[0];
  });

  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  const generateBackground = async () => {
    setIsGeneratingBg(true);
    
    // Altera ciclicamente os fundos locais do Cerrado em alta qualidade de forma instantânea e sem engasgos
    try {
      const nextIndex = (bgIndex + 1) % CERRADO_BACKGROUNDS.length;
      const nextUrl = CERRADO_BACKGROUNDS[nextIndex];
      setBgIndex(nextIndex);
      setBgUrl(nextUrl);
      localStorage.setItem('app_bg', nextUrl);
      localStorage.setItem('app_bg_index', nextIndex.toString());
    } catch (error) {
      console.error("Erro ao alternar imagem de fundo do Cerrado:", error);
    } finally {
      // Simula um curto delay para efeito visual agradável
      setTimeout(() => {
        setIsGeneratingBg(false);
      }, 150);
    }
  };

   const [copied, setCopied] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isExtracting, setIsExtracting] = useState<'resgate' | 'soltura' | null>(null);
  const [isImprovingText, setIsImprovingText] = useState(false);
  const [onlyGrammarCorrect, setOnlyGrammarCorrect] = useState(false);
  const [showImproveButton, setShowImproveButton] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // PWA/Installable states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Document Extractor states
  const [showDocExtractor, setShowDocExtractor] = useState(false);
  const [docData, setDocData] = useState({
    nome: '',
    cpf: '',
    rg: '',
    tipoDocumento: '', // 'RG' | 'CNH' | 'OUTRO' | ''
    nomeMae: '',
    nomePai: '',
    dataNascimento: '',
    dataEmissao: '',
  });
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [docTimer, setDocTimer] = useState<number>(900); // 15 minutos em segundos
  const fileInputDoc = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (showDocExtractor) {
      interval = setInterval(() => {
        setDocTimer((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            setDocData({
              nome: '',
              cpf: '',
              rg: '',
              tipoDocumento: '',
              nomeMae: '',
              nomePai: '',
              dataNascimento: '',
              dataEmissao: '',
            });
            setShowDocExtractor(false);
            alert("Sessão encerrada: Por razões de sigilo policial e conformidade com a LGPD, a sessão do Extrator de Documentos (15 minutos) expirou e todos os dados provisórios foram eliminados da memória.");
            return 900;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setDocTimer(900);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showDocExtractor]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Resposta do usuário para instalação: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      setShowInstallGuide(true);
    }
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('bpma_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('bpma_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        setHasKey(true); // Fallback for environments without the helper
      }
    };
    checkKey();
  }, []);

  const validateCoord = (val: string, type: 'lat' | 'lon') => {
    if (!val) return true;
    const num = parseFloat(val.replace(',', '.'));
    if (isNaN(num)) return false;
    if (type === 'lat') return num >= -90 && num <= 90;
    return num >= -180 && num <= 180;
  };

  const fileInputResgate = useRef<HTMLInputElement>(null);
  const fileInputSoltura = useRef<HTMLInputElement>(null);

  useEffect(() => {
    generateReport();
  }, [data]);

  const generateReport = () => {
    const now = new Date();
    const dataHora = now.toLocaleString('pt-BR');
    
    let destino = data.soltura;
    let gpsDestino = '';

    if (data.soltura === 'HFAUS') {
      gpsDestino = '';
    } else if (data.soltura === 'HVET/UNB') {
      gpsDestino = '';
    } else {
      destino = data.localSolturaManual || '';
      const lat = formatCoordinate(data.latSoltura, 'lat');
      const lon = formatCoordinate(data.lonSoltura, 'lon');
      gpsDestino = (data.latSoltura || data.lonSoltura) ? `${lat} / ${lon}` : '';
    }

    let finalCircunstancias = data.circunstancias?.trim() || '';
    
    // Remover redundâncias de acionamento via COPOM geradas pela IA
    finalCircunstancias = finalCircunstancias
      .replace(/^(A VTR .*? foi|A equipe foi|A guarnição foi|Fomos|Acionados|Acionada|Acionados via|Acionada via)\s+COPOM\s+(para atender,?\s+)?(a ocorrência|uma ocorrência|ocorrência)?(\s+de\s+(resgate de\s+)?fauna silvestre,?)?(\s+no local supramencionado,?)?\s*(sendo o espécime resgatado,?)?/gi, '')
      .replace(/^(Acionados?|Acionadas?|Acionamento)\s+via\s+COPOM,?\s*/gi, '')
      .replace(/^(Acionados?|Acionadas?|Acionamento)\s+pelo\s+COPOM,?\s*/gi, '')
      .replace(/^A equipe policial (\w+\s+)?foi acionada via COPOM para atender a ocorrência\.\s*/gi, '')
      .replace(/^A guarnição policial ambiental, acionada via COPOM, \s*/gi, '')
      .trim();

    // Se começar com letra minúscula após a remoção, capitaliza a primeira letra
    if (finalCircunstancias) {
      finalCircunstancias = finalCircunstancias.charAt(0).toUpperCase() + finalCircunstancias.slice(1);
    }
    
    // Se estiver saudável, remove menções a veterinário que a IA possa ter gerado
    if (data.condicao === 'Saudável') {
      const vetPhrases = [
        "O animal foi encaminhado para assistência veterinária especializada visando sua reabilitação e posterior reintegração ao habitat natural.",
        "O animal foi encaminhado para assistência veterinária especializada.",
        "encaminhamento para assistência veterinária especializada",
        "centro de reabilitação",
        "assistência veterinária especializada"
      ];
      
      vetPhrases.forEach(phrase => {
        if (finalCircunstancias.includes(phrase)) {
          finalCircunstancias = finalCircunstancias.replace(phrase, "").trim();
        }
      });
      
      // Limpa pontuação residual após remoção
      finalCircunstancias = finalCircunstancias.replace(/,\s*$/, "").replace(/\.\s*$/, "").trim();
    }

    const text = `A VTR ${data.vtr || 'xxxx'} foi acionada via COPOM para atender ocorrência de resgate de fauna silvestre no local supramencionado, sendo o espécime resgatado conforme as seguintes informações:

- Local do Resgate: ${formatCoordinate(data.latResgate, 'lat')} / ${formatCoordinate(data.lonResgate, 'lon')}
- Local de soltura ou encaminhamento: ${destino}${destino && gpsDestino ? ' ' : ''}${gpsDestino}
- Nome científico: ${data.especie || '---'}
- Quantidade: ${data.quantidade}
- Estágio da vida: ${data.estagioVida}
- Estado de saúde: ${data.condicao}
- Circunstâncias do resgate: ${finalCircunstancias || '---'}`;

    setReportText(text);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, type: 'resgate' | 'soltura') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(type);

    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const prompt = type === 'resgate' 
        ? "Extract the GPS coordinates (latitude and longitude) from this image. IMPORTANT: In Brazil, latitude and longitude are NEGATIVE. Ensure the returned values have the correct minus sign and exactly 6 decimal places (e.g., -15.123456). If there is an animal, identify its species (Common Name (Scientific Name)). Para o campo 'circunstancias', atue como um Policial Técnico de Meio Ambiente realizando o registro de uma ocorrência de resgate de fauna. Analise a imagem e descreva a situação de forma técnica e concisa seguindo as diretrizes de alternância e variabilidade de termos técnicos: Contexto: O animal foi encontrado em área urbana (local). ATENÇÃO: NÃO inicie o texto com menções de que a equipe foi acionada via COPOM ou de que a viatura se deslocou até o local, pois este cabeçalho padrão já consta no texto fixo do relatório. Inicie diretamente descrevendo o local e a situação visual do espécime. Estado: Avalie se o espécime apresenta sinais de debilidade/ferimentos ou se está saudável. Procedimento: Descreva o manejo técnico e o acondicionamento seguro. VARIE a redação para não usar sempre o mesmo cliché. Em vez de 'caixa de transporte adequada', use sinônimos operacionais como 'caixa de contenção apropriada', 'compartimento de transporte seguro', 'gaiola de manejo adequada', ou 'recipiente ventilado seguro'. Conclusão: Se o animal estiver debilitado, indique o encaminhamento veterinário especializado. Se estiver saudável, indique que a destinação será a soltura/devolução à natureza, também VARIANDO as expressões (ex: 'reintrodução em área de preservação ambiental', 'soltura em reserva ecológica protegida', 'devolução ao seu habitat nativo seguro', 'reinserção em reserva florestal distante da zona residencial'). Tom de voz: Formal, objetivo, de relato ambiental policial técnico, profissional e direto, porém livre de jargões técnicos excessivos, burocráticos ou militares arcaicos (como o termo 'homiziado'). Prefira termos claros e diretos (como 'localizado', 'abrigado', 'escondido', ou 'encontrado' em vez de 'homiziado'). Return ONLY a JSON object with 'lat', 'lon', 'especie', 'circunstancias', and 'condicao' keys. For 'condicao', use the string 'Saudável' if the specimen appears healthy/uninjured, or 'Debilitado' if it shows visible signs of injury, distress, or debility. Use null for any values not found."
        : "Extract the GPS coordinates (latitude and longitude) from this image. IMPORTANT: In Brazil, latitude and longitude are NEGATIVE. Ensure the returned values have the correct minus sign and exactly 6 decimal places (e.g., -15.123456). Return ONLY a JSON object with 'lat' and 'lon' keys. Use null for any values not found.";

      const response = await executeAICommand({
        action: "extractOCR",
        payload: {
          prompt,
          mimeType: file.type,
          data: base64Data
        }
      });

      let jsonExtractText = response.text || '{}';
      if (jsonExtractText.includes('```')) {
        const match = jsonExtractText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonExtractText = match[1];
        }
      }
      const result = JSON.parse(jsonExtractText.trim());
      
      setData(prev => {
        const newData = { ...prev };
        
        if (result) {
          if (type === 'resgate') {
            if (result.lat) newData.latResgate = result.lat.toString();
            if (result.lon) newData.lonResgate = result.lon.toString();
            if (result.especie) newData.especie = result.especie;
            if (result.circunstancias) newData.circunstancias = result.circunstancias;
            
            // Check if the animal is healthy based on the explicit 'condicao' key or circumstantial context
            const isHealthy = result.condicao === 'Saudável' || 
              (result.circunstancias && (
                /saudável|esta saudável|estado saudável|boas condições|sem ferimentos/i.test(result.circunstancias) && 
                !/ferido|ferimento|debilidade|debilitado/i.test(result.circunstancias)
              ));

            if (isHealthy) {
              newData.condicao = 'Saudável';
              newData.soltura = 'MANUAL'; // Corresponds to Soltura/Outro (Digitar Local e GPS)
            } else {
              newData.condicao = 'Debilitado';
              newData.soltura = 'HFAUS'; // Defaults back to HFAUS for debilitated/injured animals
            }
          } else {
            if (result.lat) newData.latSoltura = result.lat.toString();
            if (result.lon) newData.lonSoltura = result.lon.toString();
          }
        }
        return newData;
      });

      setShowImproveButton(false);

      if (!result || (!result.lat && !result.lon && !result.especie)) {
        alert('Não foi possível extrair informações desta imagem. Tente uma foto mais nítida.');
      }
    } catch (error: any) {
      console.error('OCR Error:', error);
      
      // If permission denied, prompt for key selection
      if (error?.message?.includes('403') || error?.message?.includes('permission')) {
        setHasKey(false);
        if (window.aistudio?.openSelectKey) {
          alert(`Para extrair dados de imagens, é necessário configurar uma chave de API válida com faturamento ativo. Erro: ${error.message || error}`);
          await window.aistudio.openSelectKey();
          setHasKey(true);
        } else {
          alert(`Erro de permissão. Verifique se sua chave de API possui faturamento ativo no Netlify ou no painel do provedor. Erro: ${error.message || error}`);
        }
      } else {
        alert(`Erro ao processar imagem: ${error.message || "Erro desconhecido"}. Verifique sua chave de faturamento ou sinal de internet e tente novamente.`);
      }
    } finally {
      setIsExtracting(null);
      if (event.target) event.target.value = '';
    }
  };

  const handleDocUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtractingDoc(true);

    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const prompt = `Analise atentamente a imagem deste documento de identificação brasileiro (RG, CNH, DNI, etc.).
Sua tarefa é extrair com precisão os seguintes campos cadastrais e retornar ESTRITAMENTE um objeto JSON estruturado.

Campos solicitados:
1. "tipoDocumento": Identifique a natureza do documento. Deve ser rigorosamente "RG" se for Registro Geral/Cédula de Identidade, "CNH" se for Carteira Nacional de Habilitação, ou "OUTRO" se for outro tipo de documento.
2. "rg": Se o documento for um RG (Cédula de Identidade), extraia o número do RG (Registro Geral) formatado com pontos e traço se aplicável (ex: "1.234.567" ou "1234567-8"). Se for outro documento (como CNH) ou se não encontrar o número do RG, retorne uma string vazia ("").
3. "nome": Nome completo da pessoa, em letras maiúsculas.
4. "cpf": Cadastro de Pessoas Físicas, formatado com pontos e hífen (ex: "000.000.000-00"). Remova caracteres extras e retorne apenas no formato padrão brasileiro se encontrado.
5. "nomeMae": Nome completo da mãe da pessoa, em letras maiúsculas.
6. "nomePai": Nome completo do pai da pessoa, em letras maiúsculas. Se não constar (por exemplo, "Filiacao: <Nome da mae>" sem nome do pai, ou em branco, ou ilegível), retorne uma string vazia ("").
7. "dataNascimento": Data de nascimento, formatada no padrão brasileiro de datas: "DD/MM/AAAA" (ex: "25/12/1990").
8. "dataEmissao": Se o documento for um RG, extraia a data de emissão/expedição formatada no padrão brasileiro "DD/MM/AAAA" (ex: "15/06/2018"). Caso o documento não seja um RG ou se não constar a data de emissão, retorne uma string vazia ("").

Importante:
- Se algum campo não estiver visível, estiver ilegível, ou não constar no documento, retorne uma string vazia ("") para aquele campo.
- Não invente dados sob nenhuma hipótese.
- Retorne EXCLUSIVAMENTE o objeto JSON com as chaves: "tipoDocumento", "rg", "nome", "cpf", "nomeMae", "nomePai", "dataNascimento" e "dataEmissao". Nenhum outro texto, explicação ou formatação Markdown.`;

      const response = await executeAICommand({
        action: "extractOCR",
        payload: {
          prompt,
          mimeType: file.type,
          data: base64Data
        }
      });

      let jsonText = response.text || '{}';
      if (jsonText.includes('```')) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          jsonText = match[1];
        }
      }
      
      const result = JSON.parse(jsonText.trim());
      
      setDocData(prev => ({
        tipoDocumento: (result.tipoDocumento && result.tipoDocumento.trim().toUpperCase()) || prev.tipoDocumento || '',
        rg: (result.rg && result.rg.trim()) || prev.rg || '',
        nome: (result.nome && result.nome.trim()) || prev.nome || '',
        cpf: (result.cpf && result.cpf.trim()) || prev.cpf || '',
        nomeMae: (result.nomeMae && result.nomeMae.trim()) || prev.nomeMae || '',
        nomePai: (result.nomePai && result.nomePai.trim()) || prev.nomePai || '',
        dataNascimento: (result.dataNascimento && result.dataNascimento.trim()) || prev.dataNascimento || '',
        dataEmissao: (result.dataEmissao && result.dataEmissao.trim()) || prev.dataEmissao || '',
      }));
      setDocTimer(900); // Reinicia o cronômetro de 15 minutos com novos dados extraídos

      const extractedSomething = result && (result.nome || result.cpf || result.rg || result.nomeMae || result.nomePai || result.dataNascimento || result.dataEmissao);
      if (!extractedSomething) {
        alert('Não foi possível identificar novos dados cadastrais nesta imagem. Caso tenha enviado um lado do documento que não possui texto legível, tente novamente. Seus dados anteriores foram preservados.');
      }
    } catch (error: any) {
      console.error('Doc Upload OCR Error:', error);
      alert(`Erro ao processar imagem do documento: ${error.message || "Erro desconhecido"}. Garanta que a foto esteja nítida ou digite os dados manualmente.`);
    } finally {
      setIsExtractingDoc(false);
      if (event.target) event.target.value = '';
    }
  };

  const copyDocField = async (val: string, fieldName: string) => {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy document field:', err);
    }
  };

  const handleImproveText = async () => {
    if (!data.circunstancias || !data.circunstancias.trim()) {
      alert("Escreva alguma informação ou rascunho nas circunstâncias primeiro para que a IA possa aprimorar.");
      return;
    }

    setIsImprovingText(true);
    try {
      const prompt = onlyGrammarCorrect
        ? `Você é um refinado assistente de idioma português. 
Sua tarefa é REVISAR e CORRIGIR a ortografia, pontuação, acentuação e gramática do texto fornecido abaixo sobre circunstâncias de resgate de fauna.
IMPORTANTE:
1. Mantenha exatamente a mesma estrutura original do texto, os pontos principais, as ideias e o estilo descritivo do usuário. Não altere o texto para o formato de relatório policial padrão e não adicione novos detalhes de manejo ou destinação se eles não existiam no rascunho original.
2. Apenas corrija erros ortográficos, gramaticais, de concordância e pontuação para tornar o texto gramaticalmente perfeito e fluido em português do Brasil, eliminando gírias ou erros de digitação.
3. Retorne APENAS o texto revisado e corrigido, sem qualquer introdução, sem aspas adicionais, sem notas organizacionais e sem comentários de IA.

Texto do rascunho do usuário para correção:
"${data.circunstancias}"`
        : `Você é um experiente Policial Técnico de Meio Ambiente brasileiro registrando uma ocorrência de resgate de fauna.
Aprimore o rascunho de circunstâncias a seguir, tornando-o formal, objetivo, profissional e técnico, porém no tom de voz operacional adequado e livre de jargões técnicos excessivos, burocráticos ou militares arcaicos (como por exemplo o termo "homiziado"). Prefira termos claros e diretos (como "localizado", "abrigado", "escondido", ou "encontrado" em vez de "homiziado").
IMPORTANTE:
1. Remova saudações ou quaisquer introduções redundantes que mencionem acionamento via COPOM, equipe policial acionada, deslocamento de viatura ou início padrão/clássico da ocorrência, pois esses dados já estão fixos no cabeçalho do relatório principal.
2. Inicie diretamente descrevendo o local urbano e as condições visuais operacionais do espécime (onde foi visto, estado ou situação física). Evite usar o termo "homiziado" para se referir ao animal abrigado, escondido ou localizado.
3. Descreva o manejo técnico de contenção e o acondicionamento seguro (VARIE a redação para não usar clichês como 'caixa de transporte adequada' - use expressões como 'caixa de contenção apropriada', 'compartimento de transporte seguro', 'gaiola de manejo adequada', ou 'recipiente ventilado seguro').
4. Se o animal estiver debilitado, indique o encaminhamento à assistência de veterinária especializada (HVET/UNB ou HFAUS). Se estiver saudável, indique a destinação para soltura ou devolução ao habitat natural distante de área residencial.
5. Retorne APENAS o bloco de texto aprimorado, sem aspas, sem introduções adicionais, e sem observações de IA.

Rascunho do usuário:
"${data.circunstancias}"`;

      const response = await executeAICommand({
        action: "improveText",
        payload: {
          prompt
        }
      });

      if (response && response.text) {
        let improved = response.text.trim();
        // Remove wrap quotes if returned by the model
        if (improved.startsWith('"') && improved.endsWith('"')) {
          improved = improved.slice(1, -1).trim();
        }
        if (improved.startsWith('`') && improved.endsWith('`')) {
          improved = improved.slice(1, -1).trim();
        }
        updateField('circunstancias', improved);
      } else {
        alert(onlyGrammarCorrect ? "Não foi possível corrigir o texto. Tente novamente." : "Não foi possível aprimorar o texto. Tente novamente.");
      }
    } catch (error: any) {
      console.error("Erro ao aprimorar/corrigir texto com IA:", error);
      alert(`Erro ao conectar com o serviço de IA: ${error.message || "Erro desconhecido"}. Verifique se sua chave de faturamento e GEMINI_API_KEY estão ativas e configuradas no Netlify.`);
    } finally {
      setIsImprovingText(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);

      // Salvar no histórico
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString('pt-BR'),
        text: reportText,
        especie: data.especie || 'Não identificada',
        vtr: data.vtr || 'xxxx'
      };
      
      setHistory(prev => {
        // Evita duplicatas consecutivas idênticas
        if (prev.length > 0 && prev[0].text === reportText) return prev;
        return [newItem, ...prev].slice(0, 50);
      });

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
    setShowHistory(false);
  };

  const handleClear = () => {
    setData({
      vtr: '',
      latResgate: '',
      lonResgate: '',
      soltura: 'HFAUS',
      localSolturaManual: '',
      latSoltura: '',
      lonSoltura: '',
      especie: '',
      quantidade: '1',
      estagioVida: 'Jovem',
      condicao: 'Debilitado',
      circunstancias: '',
    });
    setShowImproveButton(false);
  };

  const handleCoordinateChange = (field: keyof ReportData, value: string) => {
    const prev = data[field] || '';
    const isDeleting = value.length < prev.length;

    if (isDeleting) {
      // Se estiver deletando, deixa o usuário apagar livremente sem forçar formatação
      setData(prevData => ({ ...prevData, [field]: value }));
      return;
    }

    // Permite digitar vírgula e converte para ponto
    let val = value.replace(',', '.');

    // Remove tudo que não for número/dígito para reconstruir no formato correto
    const digits = val.replace(/\D/g, '');

    let formatted = '';
    if (digits.length > 0) {
      // Sempre começa com o sinal negativo "-" (coordenadas no Brasil)
      formatted = '-';
      if (digits.length <= 2) {
        formatted += digits;
        // Se já digitou os dois primeiros números, insere o ponto automaticamente
        if (digits.length === 2) {
          formatted += '.';
        }
      } else {
        // Se tiver mais de 2 números, formata como "-xx.xxxxxxxx"
        formatted += digits.substring(0, 2) + '.' + digits.substring(2, 12);
      }
    } else {
      // Permite que o usuário digite apenas o sinal de menos se desejar
      if (val === '-') {
        formatted = '-';
      } else {
        formatted = '';
      }
    }

    setData(prevData => ({ ...prevData, [field]: formatted }));
  };

  const formatCoordinate = (val: string, type: 'lat' | 'lon') => {
    if (!val || val === '-' || val === '.') return '---';
    
    // Preserva o sinal de menos se o usuário digitou
    const startsWithMinus = val.trim().startsWith('-');
    
    // Converte vírgula para ponto para o parseFloat funcionar corretamente
    const num = parseFloat(val.replace(',', '.'));
    if (isNaN(num)) return val;
    
    const max = type === 'lat' ? 90 : 180;
    // Se o número for muito grande (fora do range de GPS), retornamos o valor original
    if (Math.abs(num) > max) {
      return val;
    }

    // Formata para exatamente 6 casas decimais para resultar em aproximadamente 8 números no total (ex: -15.123456)
    let formatted = num.toFixed(6);
    
    // Caso especial: se o número for 0 mas o usuário digitou -0 (comum ao começar a digitar)
    if (num === 0 && startsWithMinus && !formatted.startsWith('-')) {
      formatted = '-' + formatted;
    }
    
    return formatted;
  };

  const updateField = (field: keyof ReportData, value: string) => {
    setData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Se selecionar HFAUS ou HVET/UNB, o animal não pode estar saudável
      if (field === 'soltura' && (value === 'HFAUS' || value === 'HVET/UNB')) {
        if (prev.condicao === 'Saudável') {
          newData.condicao = 'Debilitado';
        }
      }

      // Se selecionar soltura/outro (MANUAL), deixa o Estado de saúde marcado como Saudável
      if (field === 'soltura' && value === 'MANUAL') {
        newData.condicao = 'Saudável';
      }
      
      return newData;
    });

    if (field === 'circunstancias' && value.trim().length > 0) {
      setShowImproveButton(true);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-transparent">
      {/* Dynamic Background */}
      <div 
        className="fixed inset-x-0 top-0 h-[100lvh] z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 pointer-events-none select-none"
        style={{ 
          backgroundImage: bgUrl === 'solid-black' ? 'none' : `url('${bgUrl}')`,
          backgroundColor: bgUrl === 'solid-black' ? '#000' : 'transparent',
          opacity: isGeneratingBg ? 0.6 : 1,
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform, opacity',
        }}
      />
      
      {/* Subtle Overlay */}
      <div 
        className="fixed inset-x-0 top-0 h-[100lvh] z-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none select-none transition-opacity duration-700"
        style={{
          opacity: bgUrl === 'solid-black' ? 0 : 1,
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      />

      {isGeneratingBg && (
        <div className="fixed top-6 right-6 z-50 glass-card p-4 flex items-center gap-3 border-white/10">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Gerando Fauna...</span>
        </div>
      )}

      <div className="p-4 sm:p-8 lg:p-10 xl:p-12 relative z-10 max-w-none lg:pl-16">
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-start">
          {/* Coluna da Esquerda: Formulário Principal */}
          <div className="w-full max-w-xl space-y-6 flex-shrink-0">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card deep-shadow border-t-[12px] border-bpma-green overflow-hidden"
            >
        <div className="p-8">
          <header className="text-center mb-10 border-b border-white/10 pb-6">
            <h1 className="text-2xl font-black text-white uppercase tracking-tight drop-shadow-2xl">
              Relatório de Fauna
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
              <button 
                onClick={generateBackground}
                className="bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full text-[10px] text-white flex items-center gap-2 font-black transition-all border border-white/10"
                disabled={isGeneratingBg}
              >
                <Camera className="w-3.5 h-3.5" />
                {isGeneratingBg ? 'GERANDO...' : 'NOVO FUNDO'}
              </button>

              <button 
                onClick={handleInstallClick}
                className="bg-orange-600 hover:bg-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.4)] px-4 py-1.5 rounded-full text-[10px] text-white flex items-center gap-2 font-black transition-all border border-orange-500/20"
              >
                <Smartphone className="w-3.5 h-3.5" />
                {deferredPrompt ? 'INSTALAR APP' : 'BAIXAR NO CELULAR'}
              </button>

              <button 
                onClick={() => {
                  setShowDocExtractor(!showDocExtractor);
                  if (!showDocExtractor) {
                    setTimeout(() => {
                      document.getElementById('doc-extractor-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 150);
                  }
                }}
                className={`px-4 py-1.5 rounded-full text-[10px] flex items-center gap-2 font-black transition-all border h-7 ${
                  showDocExtractor 
                    ? 'bg-[#2e7d32] border-[#2e7d32]/20 text-white shadow-[0_0_15px_rgba(46,125,50,0.4)] hover:bg-emerald-600' 
                    : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {showDocExtractor ? 'CONCLUIR EXTRAÇÃO' : 'ESCANEAR DOC'}
              </button>
            </div>
          </header>

          <div className="space-y-1">
            <div>
              <label>VTR:</label>
              <input 
                type="text" 
                value={data.vtr}
                onChange={(e) => updateField('vtr', e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 4434" 
                maxLength={4}
                inputMode="numeric"
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="mb-0">Local do Resgate (Coordenadas):</label>
                <button 
                  onClick={async () => {
                    if (hasKey === false && window.aistudio?.openSelectKey) {
                      await window.aistudio.openSelectKey();
                      setHasKey(true);
                    }
                    fileInputResgate.current?.click();
                  }}
                  disabled={isExtracting !== null}
                  className="flex items-center gap-1 text-[10px] font-bold text-white bg-orange-600 px-2 py-1 rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 border border-orange-500/50 shadow-[0_0_15px_rgba(234,88,12,0.3)]"
                >
                  {isExtracting === 'resgate' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  EXTRAIR GPS
                </button>
                <input 
                  type="file" 
                  ref={fileInputResgate} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={(e) => handleFileUpload(e, 'resgate')} 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input 
                    className={`${!validateCoord(data.latResgate, 'lat') ? 'border-red-500/60 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                    type="text" 
                    inputMode="decimal"
                    value={data.latResgate}
                    onChange={(e) => handleCoordinateChange('latResgate', e.target.value)}
                    placeholder="Latitude" 
                  />
                  {!validateCoord(data.latResgate, 'lat') && <span className="text-[9px] font-black text-red-400 absolute -bottom-4 left-0 uppercase tracking-tighter">Latitude Inválida (-90 a 90)</span>}
                </div>
                <div className="relative">
                  <input 
                    className={`${!validateCoord(data.lonResgate, 'lon') ? 'border-red-500/60 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                    type="text" 
                    inputMode="decimal"
                    value={data.lonResgate}
                    onChange={(e) => handleCoordinateChange('lonResgate', e.target.value)}
                    placeholder="Longitude" 
                  />
                  {!validateCoord(data.lonResgate, 'lon') && <span className="text-[9px] font-black text-red-400 absolute -bottom-4 left-0 uppercase tracking-tighter">Longitude Inválida (-180 a 180)</span>}
                </div>
              </div>
            </div>

            <div>
              <label>Soltura / Encaminhamento:</label>
              <select 
                value={data.soltura}
                onChange={(e) => updateField('soltura', e.target.value as SolturaOption)}
              >
                <option value="HFAUS">HFAUS</option>
                <option value="HVET/UNB">HVET/UNB</option>
                <option value="MANUAL">Soltura/Outro (Digitar Local e GPS)</option>
              </select>
            </div>

            <AnimatePresence>
              {data.soltura === 'MANUAL' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-transparent p-4 rounded-xl border border-white/10 mt-4 space-y-3">
                    <div>
                      <label className="mt-0">Nome do Local (Opcional):</label>
                      <input 
                        type="text" 
                        value={data.localSolturaManual}
                        onChange={(e) => updateField('localSolturaManual', e.target.value)}
                        placeholder="Ex: Reserva Ecológica" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="mb-0 mt-0">Coordenadas de Soltura:</label>
                        <button 
                          onClick={async () => {
                            if (hasKey === false && window.aistudio?.openSelectKey) {
                              await window.aistudio.openSelectKey();
                              setHasKey(true);
                            }
                            fileInputSoltura.current?.click();
                          }}
                          disabled={isExtracting !== null}
                          className="flex items-center gap-1 text-[10px] font-bold text-white bg-orange-600 px-2 py-1 rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 border border-orange-500/50 shadow-[0_0_15px_rgba(234,88,12,0.3)]"
                        >
                          {isExtracting === 'soltura' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                          EXTRAIR GPS
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputSoltura} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, 'soltura')} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <input 
                            className={`${!validateCoord(data.latSoltura, 'lat') ? 'border-red-500/60 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                            type="text" 
                            inputMode="decimal"
                            value={data.latSoltura}
                            onChange={(e) => handleCoordinateChange('latSoltura', e.target.value)}
                            placeholder="Latitude" 
                          />
                          {!validateCoord(data.latSoltura, 'lat') && <span className="text-[9px] font-black text-red-400 absolute -bottom-4 left-0 uppercase tracking-tighter">Latitude Inválida (-90 a 90)</span>}
                        </div>
                        <div className="relative">
                          <input 
                            className={`${!validateCoord(data.lonSoltura, 'lon') ? 'border-red-500/60 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : ''}`}
                            type="text" 
                            inputMode="decimal"
                            value={data.lonSoltura}
                            onChange={(e) => handleCoordinateChange('lonSoltura', e.target.value)}
                            placeholder="Longitude" 
                          />
                          {!validateCoord(data.lonSoltura, 'lon') && <span className="text-[9px] font-black text-red-400 absolute -bottom-4 left-0 uppercase tracking-tighter">Longitude Inválida (-180 a 180)</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label>Espécie / Nome Científico:</label>
              <input 
                type="text" 
                value={data.especie}
                onChange={(e) => updateField('especie', e.target.value)}
                placeholder="Ex: Saruê (Didelphis albiventris)" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Quantidade:</label>
                <input 
                  type="number" 
                  value={data.quantidade}
                  onChange={(e) => updateField('quantidade', e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <label>Estágio de Vida:</label>
                <select 
                  value={data.estagioVida}
                  onChange={(e) => updateField('estagioVida', e.target.value)}
                >
                  <option value="Filhote">Filhote</option>
                  <option value="Jovem">Jovem</option>
                  <option value="Adulto">Adulto</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label>Estado de Saúde:</label>
                <select 
                  value={data.condicao}
                  onChange={(e) => updateField('condicao', e.target.value)}
                >
                  <option value="Saudável" disabled={data.soltura === 'HFAUS' || data.soltura === 'HVET/UNB'}>
                    Saudável
                  </option>
                  <option value="Debilitado">Debilitado</option>
                  <option value="Óbito">Óbito</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mt-6 mb-2">
                <label className="m-0 p-0">Circunstâncias do Resgate:</label>
                <div className="flex items-center gap-2">
                  {showImproveButton && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-medium text-[#F5F5F7]/80 hover:text-white cursor-pointer select-none transition-all mr-1">
                        <input 
                          type="checkbox"
                          checked={onlyGrammarCorrect}
                          onChange={(e) => setOnlyGrammarCorrect(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border border-white/20 bg-black/40 text-emerald-600 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all"
                        />
                        <span>Apenas Ortografia</span>
                      </label>
                      <button 
                        type="button"
                        onClick={handleImproveText}
                        disabled={isImprovingText || !data.circunstancias?.trim()}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-emerald-600 px-2 py-1 rounded-md hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 cursor-pointer uppercase tracking-normal"
                      >
                        {isImprovingText ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                            {onlyGrammarCorrect ? 'Corrigindo...' : 'Aprimorando...'}
                          </>
                        ) : (
                          <>
                            {onlyGrammarCorrect ? (
                              <Check className="w-3 h-3 text-emerald-100" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-emerald-100" />
                            )}
                            {onlyGrammarCorrect ? 'Corrigir Texto' : 'Melhorar com IA'}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  <button 
                    type="button"
                    onClick={() => {
                      updateField('circunstancias', '');
                      setShowImproveButton(true);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-white bg-orange-600 px-2 py-1 rounded-md hover:bg-orange-700 transition-all border border-orange-500/50 shadow-[0_0_15px_rgba(234,88,12,0.3)] active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar Texto
                  </button>
                </div>
              </div>
              <textarea 
                rows={6}
                value={data.circunstancias}
                onChange={(e) => updateField('circunstancias', e.target.value)}
                placeholder="Escreva um rascunho rápido ou observações para que a IA possa polir e transformar em um relato policial técnico completo..."
              />
            </div>

            <div className="pt-8 space-y-6">
              <div className="bg-transparent border-2 border-dashed border-white/10 rounded-2xl p-6 shadow-inner">
                <div className="flex items-center gap-2 text-[#F5F5F7] mb-4">
                  <Info className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Prévia do Relatório</span>
                </div>
                <pre className="text-[14px] whitespace-pre-wrap font-mono leading-relaxed font-bold">
                  {reportText}
                </pre>
              </div>

              <button 
                onClick={handleCopy}
                className={`w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl border border-white/10 ${
                  copied ? 'bg-green-600 text-white' : 'bg-bpma-green text-white hover:bg-bpma-accent'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-7 h-7" />
                    COPIADO!
                  </>
                ) : (
                  <>
                    <Copy className="w-7 h-7" />
                    COPIAR RELATÓRIO
                  </>
                )}
              </button>

              <button 
                onClick={handleClear}
                className="w-full py-4 rounded-2xl font-black text-sm text-red-500 border border-red-500/20 bg-transparent hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Trash2 className="w-5 h-5" />
                LIMPAR CAMPOS
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>

    {/* Coluna da Direita: Extrator & Histórico */}
    <div className="w-full max-w-xl space-y-6 mt-0">
      {/* Seção do Extrator de Documentos (RG/CNH) */}
      <AnimatePresence>
        {showDocExtractor && (
          <motion.div
            id="doc-extractor-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="glass-card deep-shadow border-t-[12px] border-orange-500 overflow-hidden"
          >
            <div className="p-8">
              <header className="flex items-center justify-between border-b border-white/10 pb-5 mb-6">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-6 h-6 text-orange-500" />
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Extrator de Documentos</h2>
                    <p className="text-[10px] text-white/50 font-mono uppercase tracking-widest mt-0.5">Identidade, CPF e Nascimento via IA</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <button 
                    onClick={() => setShowDocExtractor(false)}
                    className="p-1 px-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all text-xs font-black uppercase tracking-wider border border-white/10"
                  >
                    Fechar
                  </button>
                  <div className="flex items-center gap-1 text-[9px] font-mono font-black text-orange-400 bg-orange-950/40 border border-orange-500/20 px-2 py-0.5 rounded-md animate-pulse">
                    <Clock className="w-3 h-3 text-orange-400" />
                    EXPIRA EM: {formatTimer(docTimer)}
                  </div>
                </div>
              </header>

              <div className="space-y-5">
                {/* Shield Confidentiality Notice */}
                <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 flex gap-3 items-start select-none">
                  <Shield className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-orange-400">
                      Declaração de Sigilo & Proteção de Dados (LGPD)
                    </h4>
                    <p className="text-[11px] text-[#F5F5F7]/80 mt-1 font-semibold leading-relaxed">
                      Este módulo opera de forma estritamente operacional e transitória. 
                      Nenhuma imagem ou informação extraída é armazenada, catalogada ou compartilhada pelo sistema. 
                      Por segurança, <strong className="text-orange-400">todas as informações extraídas e a sessão expiram em 15 minutos</strong>, destruindo temporariamente os dados locais.
                    </p>
                  </div>
                </div>

                {/* File picker */}
                <div 
                  onClick={() => fileInputDoc.current?.click()}
                  className="border-2 border-dashed border-white/10 hover:border-orange-500/40 bg-white/5 hover:bg-white/10 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center gap-3 shadow-inner"
                >
                  <Camera className="w-7 h-7 text-orange-500 group-hover:scale-110 group-hover:text-orange-400 transition-all duration-300" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-white">Toque para selecionar / Enviar foto do documento</p>
                    <p className="text-[10px] text-orange-400 mt-1.5 font-bold uppercase tracking-wider">
                      Leitura Frente & Verso Integrada
                    </p>
                    <p className="text-[9px] text-[#F5F5F7]/50 mt-1 font-semibold uppercase tracking-wider leading-relaxed">
                      Carregue a Frente primeiro e depois o Verso (ou vice-versa) para mesclar todos os dados automaticamente sem apagar as leituras anteriores!
                    </p>
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputDoc} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleDocUpload} 
                />

                {isExtractingDoc ? (
                  <div className="border border-white/5 rounded-2xl p-8 bg-white/5 flex flex-col items-center justify-center gap-4 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-[0.2em]">Extraindo Campos Cadastrais...</p>
                      <p className="text-[10px] text-[#F5F5F7]/45 mt-1">Conectando ao gateway de IA seguro</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Exposição e Cópia campo por campo */}
                    <div className="grid grid-cols-1 gap-4">
                      {/* Nome */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="mt-0 mb-0 text-[10px] drop-shadow-none">Nome Completo</label>
                          {copiedField === 'nome' && (
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Copiado!</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={docData.nome}
                            onChange={(e) => setDocData(prev => ({ ...prev, nome: e.target.value.toUpperCase() }))}
                            placeholder="Aguardando documento..."
                            className="bg-black/30 text-xs font-semibold focus:shadow-[0_0_15px_rgba(234,88,12,0.2)] focus:ring-orange-500/50"
                          />
                          <button 
                            onClick={() => copyDocField(docData.nome, 'nome')}
                            disabled={!docData.nome}
                            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer w-14 ${
                              copiedField === 'nome' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                            } disabled:opacity-20`}
                          >
                            {copiedField === 'nome' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* CPF */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="mt-0 mb-0 text-[10px] drop-shadow-none">CPF</label>
                          {copiedField === 'cpf' && (
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Copiado!</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={docData.cpf}
                            onChange={(e) => setDocData(prev => ({ ...prev, cpf: e.target.value }))}
                            placeholder="Aguardando documento..."
                            className="bg-black/30 text-xs font-mono font-semibold focus:shadow-[0_0_15px_rgba(234,88,12,0.2)] focus:ring-orange-500/50"
                          />
                          <button 
                            onClick={() => copyDocField(docData.cpf, 'cpf')}
                            disabled={!docData.cpf}
                            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer w-14 ${
                              copiedField === 'cpf' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                            } disabled:opacity-20`}
                          >
                            {copiedField === 'cpf' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* RG */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="mt-0 mb-0 text-[10px] drop-shadow-none">RG (Cédula de Identidade)</label>
                          {copiedField === 'rg' && (
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Copiado!</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={docData.rg}
                            onChange={(e) => setDocData(prev => ({ ...prev, rg: e.target.value }))}
                            placeholder="Aguardando documento..."
                            className="bg-black/30 text-xs font-mono font-semibold focus:shadow-[0_0_15px_rgba(234,88,12,0.2)] focus:ring-orange-500/50"
                          />
                          <button 
                            onClick={() => copyDocField(docData.rg, 'rg')}
                            disabled={!docData.rg}
                            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer w-14 ${
                              copiedField === 'rg' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                            } disabled:opacity-20`}
                          >
                            {copiedField === 'rg' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Nome da Mãe */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="mt-0 mb-0 text-[10px] drop-shadow-none">Nome da Mãe</label>
                          {copiedField === 'nomeMae' && (
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Copiado!</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={docData.nomeMae}
                            onChange={(e) => setDocData(prev => ({ ...prev, nomeMae: e.target.value.toUpperCase() }))}
                            placeholder="Aguardando documento..."
                            className="bg-black/30 text-xs font-semibold focus:shadow-[0_0_15px_rgba(234,88,12,0.2)] focus:ring-orange-500/50"
                          />
                          <button 
                            onClick={() => copyDocField(docData.nomeMae, 'nomeMae')}
                            disabled={!docData.nomeMae}
                            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer w-14 ${
                              copiedField === 'nomeMae' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                            } disabled:opacity-20`}
                          >
                            {copiedField === 'nomeMae' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Nome do Pai */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="mt-0 mb-0 text-[10px] drop-shadow-none">Nome do Pai</label>
                          {copiedField === 'nomePai' && (
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Copiado!</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={docData.nomePai}
                            onChange={(e) => setDocData(prev => ({ ...prev, nomePai: e.target.value.toUpperCase() }))}
                            placeholder="Aguardando documento..."
                            className="bg-black/30 text-xs font-semibold focus:shadow-[0_0_15px_rgba(234,88,12,0.2)] focus:ring-orange-500/50"
                          />
                          <button 
                            onClick={() => copyDocField(docData.nomePai, 'nomePai')}
                            disabled={!docData.nomePai}
                            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer w-14 ${
                              copiedField === 'nomePai' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                            } disabled:opacity-20`}
                          >
                            {copiedField === 'nomePai' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Data de Nascimento */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="mt-0 mb-0 text-[10px] drop-shadow-none">Data de Nascimento</label>
                          {copiedField === 'dataNascimento' && (
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Copiado!</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={docData.dataNascimento}
                            onChange={(e) => setDocData(prev => ({ ...prev, dataNascimento: e.target.value }))}
                            placeholder="Aguardando documento..."
                            className="bg-black/30 text-xs font-semibold focus:shadow-[0_0_15px_rgba(234,88,12,0.2)] focus:ring-orange-500/50"
                          />
                          <button 
                            onClick={() => copyDocField(docData.dataNascimento, 'dataNascimento')}
                            disabled={!docData.dataNascimento}
                            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer w-14 ${
                              copiedField === 'dataNascimento' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                            } disabled:opacity-20`}
                          >
                            {copiedField === 'dataNascimento' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Data de Emissão (RG) */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="mt-0 mb-0 text-[10px] drop-shadow-none">Data de Emissão (Se RG)</label>
                          {copiedField === 'dataEmissao' && (
                            <span className="text-[9px] font-black text-green-400 uppercase tracking-wider">Copiado!</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={docData.dataEmissao}
                            onChange={(e) => setDocData(prev => ({ ...prev, dataEmissao: e.target.value }))}
                            placeholder="Aguardando documento..."
                            className="bg-black/30 text-xs font-semibold focus:shadow-[0_0_15px_rgba(234,88,12,0.2)] focus:ring-orange-500/50"
                          />
                          <button 
                            onClick={() => copyDocField(docData.dataEmissao, 'dataEmissao')}
                            disabled={!docData.dataEmissao}
                            className={`p-4 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer w-14 ${
                              copiedField === 'dataEmissao' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                            } disabled:opacity-20`}
                          >
                            {copiedField === 'dataEmissao' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {(docData.nome || docData.cpf || docData.rg || docData.tipoDocumento || docData.nomeMae || docData.nomePai || docData.dataNascimento || docData.dataEmissao) && (
                      <button
                        onClick={() => setDocData({ nome: '', cpf: '', rg: '', tipoDocumento: '', nomeMae: '', nomePai: '', dataNascimento: '', dataEmissao: '' })}
                        className="w-full mt-4 py-4 rounded-2xl font-black text-[10px] text-red-500 border border-red-500/20 bg-transparent hover:bg-red-600 hover:text-white transition-all tracking-[0.2em] uppercase"
                      >
                        Limpar Dados do Extrator
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seção de Histórico */}
      <div className="mt-0 w-full">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="w-full glass-card p-5 flex items-center justify-between transition-all active:scale-[0.98] deep-shadow"
        >
          <div className="flex items-center gap-4 text-white">
            <History className="w-6 h-6 text-bpma-accent" />
            <span className="font-black uppercase tracking-widest text-sm">Histórico</span>
            <span className="bg-bpma-green text-white text-[10px] px-2.5 py-1 rounded-full font-black">
              {history.length}
            </span>
          </div>
          {showHistory ? <ChevronUp className="w-6 h-6 text-white/30" /> : <ChevronDown className="w-6 h-6 text-white/30" />}
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-6 space-y-4">
                {history.length === 0 ? (
                  <div className="glass-card p-10 border-dashed border-white/10 text-center">
                    <Clock className="w-10 h-10 text-white/10 mx-auto mb-4" />
                    <p className="text-[#F5F5F7]/40 text-sm font-bold">Histórico Vazio</p>
                  </div>
                ) : (
                  <>
                    {history.map((item) => (
                      <motion.div 
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-card p-6 border-l-8 border-bpma-green relative group"
                      >
                        <button 
                          onClick={() => deleteHistoryItem(item.id)}
                          className="absolute top-4 right-4 p-2 text-white/20 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-3 text-[10px] text-[#F5F5F7]/60 font-mono mb-3 font-bold uppercase tracking-widest">
                          <Clock className="w-3.5 h-3.5" />
                          {item.timestamp}
                          <span className="bg-bpma-green text-white px-2 py-0.5 rounded font-black">VTR {item.vtr}</span>
                        </div>
                        
                        <h3 className="text-lg font-black text-white mb-3 truncate pr-8 uppercase tracking-tight">
                          {item.especie}
                        </h3>
                        
                        <div className="bg-transparent p-4 rounded-2xl mb-4 border border-white/5">
                          <pre className="text-[12px] whitespace-pre-wrap font-mono leading-tight max-h-32 overflow-y-auto font-bold">
                            {item.text}
                          </pre>
                        </div>
                        
                        <button 
                          onClick={async () => {
                            await navigator.clipboard.writeText(item.text);
                            const btn = document.getElementById(`copy-${item.id}`);
                            if (btn) {
                              btn.innerText = 'COPIADO!';
                              btn.classList.add('bg-green-600');
                            }
                            setTimeout(() => {
                              if (btn) {
                                btn.innerText = 'COPIAR NOVAMENTE';
                                btn.classList.remove('bg-green-600');
                              }
                            }, 2000);
                          }}
                          id={`copy-${item.id}`}
                          className="w-full py-3 bg-bpma-green text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-bpma-accent transition-all flex items-center justify-center gap-3 shadow-xl"
                        >
                          <Copy className="w-4 h-4" />
                          COPIAR NOVAMENTE
                        </button>
                      </motion.div>
                    ))}
                    
                    <button 
                      onClick={clearHistory}
                      className="w-full py-4 bg-red-600/20 text-red-500 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white rounded-2xl transition-all shadow-xl border border-red-500/20"
                    >
                      Limpar Todo o Histórico
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div> {/* Fim da Coluna da Direita */}
  </div> {/* Fim do Flex Container */}

      {/* PWA Installation Assistant Guide Overlay */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card max-w-md w-full p-6 text-left border border-white/20 relative"
            >
              <button 
                onClick={() => setShowInstallGuide(false)}
                className="absolute top-4 right-4 p-2 text-white/60 hover:text-white rounded-full bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                <Smartphone className="w-6 h-6 text-orange-500" />
                Instalar no Celular
              </h3>
              
              <p className="text-sm text-white/80 mb-6 font-bold">
                Você pode instalar este aplicativo nativamente no seu celular para acessar de forma instantânea com ícone próprio e suporte offline completo. Siga as instruções para seu dispositivo:
              </p>

              <div className="space-y-4">
                <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                  <h4 className="text-[#F5F5F7] font-black text-xs uppercase tracking-wider mb-2">
                    📱 Android (Chrome / Samsung)
                  </h4>
                  <p className="text-xs text-white/70 font-semibold leading-relaxed">
                    1. No topo superior direito da barra de endereço, clique nos <strong className="text-white">três pontinhos</strong>.<br/>
                    2. Selecione <strong className="text-white">"Adicionar à tela inicial"</strong> ou <strong className="text-white">"Instalar aplicativo"</strong>.<br/>
                    3. Confirme e o app será criado na sua gaveta de aplicativos.
                  </p>
                </div>

                <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                  <h4 className="text-[#F5F5F7] font-black text-xs uppercase tracking-wider mb-2">
                    🍎 iPhone / iPad (Safari)
                  </h4>
                  <p className="text-xs text-white/70 font-semibold leading-relaxed">
                    1. No rodapé do Safari, clique no botão de <strong className="text-white">Compartilhar</strong> (ícone de quadrado com seta para cima).<br/>
                    2. Role a lista para baixo e selecione <strong className="text-white">"Adicionar à Tela de Início"</strong>.<br/>
                    3. Clique em <strong className="text-white">"Adicionar"</strong> e use como um aplicativo nativo.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowInstallGuide(false)}
                className="w-full mt-6 py-4 bg-bpma-green hover:bg-bpma-accent text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all text-center"
              >
                Entendi, continuar usando
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <footer className="mt-8 text-center text-[#F5F5F7]/40 text-[10px] uppercase tracking-widest">
      </footer>
    </div>
  </div>
  );
}
