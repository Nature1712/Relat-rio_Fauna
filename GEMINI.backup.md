# Wildlife Rescue App - Estado Atual e Prompts

Este arquivo serve como um ponto de restauração e documentação para o estado atual do aplicativo de resgate de fauna.

## 1. Prompt de Geração de Fundo (Background)
Utilizado para criar a atmosfera visual do Cerrado Brasileiro com fauna local:
> "cinematic shot of a maned wolf in the Brazilian Cerrado at sunset, silhouettes of a pair of macaws flying far away in the distance against the vibrant orange and amber sky, warm glowing light, photorealistic, 4k, high contrast"

## 2. Prompt de Extração de Dados (IA)
Utilizado para processar fotos e extrair GPS/Espécie de forma dinâmica e pouco repetitiva:
> "Extract the GPS coordinates (latitude and longitude) from this image. IMPORTANT: In Brazil, latitude and longitude are NEGATIVE. Ensure the returned values have the correct minus sign and exactly 6 decimal places (e.g., -15.123456). If there is an animal, identify its species (Common Name (Scientific Name)). Para o campo 'circunstancias', atue como um Policial Militar Ambiental realizando o registro de uma ocorrência de resgate de fauna. Analise a imagem e descreva a situação de forma técnica e concisa seguindo as diretrizes de alternância e variabilidade de termos técnicos: Contexto: O animal foi encontrado em área urbana (local). ATENÇÃO: NÃO inicie o texto com menções de que a equipe foi acionada via COPOM ou de que a viatura se deslocou até o local, pois este cabeçalho padrão já consta no texto fixo do relatório. Inicie diretamente descrevendo o local e a situação visual do espécime. Estado: Avalie se o espécime apresenta sinais de debilidade/ferimentos ou se está saudável. Procedimento: Descreva o manejo técnico e o acondicionamento seguro. VARIE a redação para não usar sempre o mesmo cliché. Em vez de 'caixa de transporte adequada', use sinônimos operacionais como 'caixa de contenção apropriada', 'compartimento de transporte seguro', 'gaiola de manejo adequada', ou 'recipiente ventilado seguro'. Conclusão: Se o animal estiver debilitado, indique o encaminhamento veterinário especializado. Se estiver saudável, indique que a destinação será a soltura/devolução à natureza, também VARIANDO as expressões (ex: 'reintrodução em área de preservação ambiental', 'soltura em reserva ecológica protegida', 'devolução ao seu habitat nativo seguro', 'reinserção em reserva florestal distante da zona residencial'). Tom de voz: Formal, objetivo, militar operacional e bastante variado para evitar repetição textual entre ocorrências diferentes. Return ONLY a JSON object with 'lat', 'lon', 'especie', 'circunstancias', and 'condicao' keys. For 'condicao', use the string 'Saudável' if the specimen appears healthy/uninjured, or 'Debilitado' if it shows visible signs of injury, distress, or debility. Use null for any values not found."

## 3. Configurações de UI e Estilo
- **Transparência:** Cartões com `bg-transparent` e bordas `white/10`.
- **Botões de GPS:** Laranja forte (`bg-orange-600`) com sombra alaranjada.
- **Precisão GPS:** 6 casas decimals (totalizando aproximadamente 8 dígitos no relatório).
- **Fundo Base:** Preto sólido (`#000`).
- **Regras de Negócio:** 
  - Se o destino for HFAUS ou HVET/UNB, o estado de saúde "Saudável" é bloqueado e alterado automaticamente para "Debilitado".
  - Se o estado de saúde for "Saudável", qualquer menção a encaminhamento veterinário gerada pela IA é removida automaticamente do relatório para evitar contradições.
  - Para evitar dupla menção e redundância no relatório, qualquer introdução que fale de "Acionamento via COPOM" ou similar gerada pela IA no relatório é removida pelo código de limpeza, mantendo o início direto na descrição do espécime.

## 4. Funcionalidades Principais
- Geração dinâmica de fundo via IA.
- Extração de metadados GPS de fotos.
- Identificação visual de espécies via IA.
- Histórico local persistente.
- Relatório formatado para compartilhamento via WhatsApp.
