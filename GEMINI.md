# Wildlife Rescue App - Estado Atual e Prompts

Este arquivo serve como um ponto de restauração e documentação para o estado atual do aplicativo de resgate de fauna.

## 1. Prompt de Geração de Fundo (Background)
Utilizado para criar a atmosfera visual do Cerrado Brasileiro com fauna local:
> "cinematic shot of a maned wolf in the Brazilian Cerrado at sunset, silhouettes of a pair of macaws flying far away in the distance against the vibrant orange and amber sky, warm glowing light, photorealistic, 4k, high contrast"

## 2. Prompt de Extração de Dados (IA)
Utilizado para processar fotos e extrair GPS/Espécie:
> "Extract the GPS coordinates (latitude and longitude) from this image. IMPORTANT: In Brazil, latitude and longitude are NEGATIVE. Ensure the returned values have the correct minus sign and exactly 6 decimal places (e.g., -15.123456). If there is an animal, identify its species (Common Name (Scientific Name)). Para o campo 'circunstancias', atue como um Policial Militar Ambiental realizando o registro de uma ocorrência de resgate de fauna. Analise a imagem e descreva a situação de forma técnica e concisa seguindo as diretrizes: Contexto: O animal foi encontrado em área urbana (local). Estado: O espécime apresenta sinais visíveis de debilidade ou ferimentos. Procedimento: Descreva o manejo técnico, informando que o animal foi acondicionado em caixa de transporte adequada para garantir a segurança e o bem-estar durante o trajeto. Conclusão: Finalize informando o encaminhamento para assistência veterinária especializada ou centro de reabilitação. Tom de voz: Formal, objetivo e operacional. Evite repetições de palavras e adjetivos desnecessários. O texto deve ser fluido e direto ao ponto. Return ONLY a JSON object with 'lat', 'lon', 'especie', and 'circunstancias' keys. Use null for any values not found."

## 3. Configurações de UI e Estilo
- **Transparência:** Cartões com `bg-transparent` e bordas `white/10`.
- **Botões de GPS:** Laranja forte (`bg-orange-600`) com sombra alaranjada.
- **Precisão GPS:** 6 casas decimais (totalizando aproximadamente 8 dígitos no relatório).
- **Fundo Base:** Preto sólido (`#000`).
- **Regras de Negócio:** 
  - Se o destino for HFAUS ou HVET/UNB, o estado de saúde "Saudável" é bloqueado e alterado automaticamente para "Debilitado".
  - Se o estado de saúde for "Saudável", qualquer menção a encaminhamento veterinário gerada pela IA é removida automaticamente do relatório para evitar contradições.

## 4. Funcionalidades Principais
- Geração dinâmica de fundo via IA.
- Extração de metadados GPS de fotos.
- Identificação visual de espécies via IA.
- Histórico local persistente.
- Relatório formatado para compartilhamento via WhatsApp.
