export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      administracao_administrador: {
        Row: {
          conta_id: string
          criado_em: string
        }
        Insert: {
          conta_id: string
          criado_em?: string
        }
        Update: {
          conta_id?: string
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "administracao_administrador_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: true
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      administracao_auditoria: {
        Row: {
          acao: string
          alvo_id: string
          alvo_tabela: string
          autor_id: string
          criado_em: string
          id: number
          motivo: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          alvo_id: string
          alvo_tabela: string
          autor_id: string
          criado_em?: string
          id?: never
          motivo?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          alvo_id?: string
          alvo_tabela?: string
          autor_id?: string
          criado_em?: string
          id?: never
          motivo?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "administracao_auditoria_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      administracao_patrocinador: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          fim_em: string | null
          id: string
          imagem_path: string
          inicio_em: string | null
          ordem: number
          perfil_destino_id: string | null
          texto_destino: string | null
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          fim_em?: string | null
          id?: string
          imagem_path: string
          inicio_em?: string | null
          ordem?: number
          perfil_destino_id?: string | null
          texto_destino?: string | null
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          fim_em?: string | null
          id?: string
          imagem_path?: string
          inicio_em?: string | null
          ordem?: number
          perfil_destino_id?: string | null
          texto_destino?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "administracao_patrocinador_perfil_destino_id_fkey"
            columns: ["perfil_destino_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracao_patrocinador_perfil_destino_id_fkey"
            columns: ["perfil_destino_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracao_patrocinador_perfil_destino_id_fkey"
            columns: ["perfil_destino_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_categoria: {
        Row: {
          ativa: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      catalogo_categoria_solicitacao: {
        Row: {
          categoria_id: string | null
          criado_em: string
          decidida_em: string | null
          decidida_por: string | null
          id: string
          justificativa: string | null
          motivo_resposta: string | null
          nome_sugerido: string
          situacao: string
          solicitante_id: string
        }
        Insert: {
          categoria_id?: string | null
          criado_em?: string
          decidida_em?: string | null
          decidida_por?: string | null
          id?: string
          justificativa?: string | null
          motivo_resposta?: string | null
          nome_sugerido: string
          situacao?: string
          solicitante_id: string
        }
        Update: {
          categoria_id?: string | null
          criado_em?: string
          decidida_em?: string | null
          decidida_por?: string | null
          id?: string
          justificativa?: string | null
          motivo_resposta?: string | null
          nome_sugerido?: string
          situacao?: string
          solicitante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_categoria_solicitacao_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_categoria_solicitacao_decidida_por_fkey"
            columns: ["decidida_por"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_categoria_solicitacao_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_item: {
        Row: {
          atualizado_em: string
          conta_id: string
          criado_em: string
          id: string
          perfil_id: string | null
          publicado: boolean
          tipo: string
          versao_aprovada_id: string | null
        }
        Insert: {
          atualizado_em?: string
          conta_id: string
          criado_em?: string
          id?: string
          perfil_id?: string | null
          publicado?: boolean
          tipo: string
          versao_aprovada_id?: string | null
        }
        Update: {
          atualizado_em?: string
          conta_id?: string
          criado_em?: string
          id?: string
          perfil_id?: string | null
          publicado?: boolean
          tipo?: string
          versao_aprovada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_item_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_perfil_da_conta_fk"
            columns: ["perfil_id", "conta_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id", "responsavel_id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_aprovada_fk"
            columns: ["versao_aprovada_id", "id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_versao"
            referencedColumns: ["id", "item_id"]
          },
        ]
      }
      catalogo_item_revisao: {
        Row: {
          autor_id: string
          decidida_em: string
          decisao: string
          id: string
          item_id: string
          motivo: string | null
          versao_aprovada_anterior_id: string | null
          versao_id: string
        }
        Insert: {
          autor_id: string
          decidida_em?: string
          decisao: string
          id?: string
          item_id: string
          motivo?: string | null
          versao_aprovada_anterior_id?: string | null
          versao_id: string
        }
        Update: {
          autor_id?: string
          decidida_em?: string
          decisao?: string
          id?: string
          item_id?: string
          motivo?: string | null
          versao_aprovada_anterior_id?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_item_revisao_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_revisao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_revisao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_revisao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_meus_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_revisao_versao_aprovada_anterior_id_fkey"
            columns: ["versao_aprovada_anterior_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_versao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_revisao_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "catalogo_item_versao"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_item_versao: {
        Row: {
          categoria_principal_id: string | null
          categoria_secundaria_1_id: string | null
          categoria_secundaria_2_id: string | null
          cidade: string | null
          criado_em: string
          descricao: string | null
          enviada_em: string | null
          foto_path: string | null
          id: string
          item_id: string
          nome: string | null
          preco_centavos: number | null
          preco_modo: string | null
          situacao: string
          uf: string | null
        }
        Insert: {
          categoria_principal_id?: string | null
          categoria_secundaria_1_id?: string | null
          categoria_secundaria_2_id?: string | null
          cidade?: string | null
          criado_em?: string
          descricao?: string | null
          enviada_em?: string | null
          foto_path?: string | null
          id?: string
          item_id: string
          nome?: string | null
          preco_centavos?: number | null
          preco_modo?: string | null
          situacao?: string
          uf?: string | null
        }
        Update: {
          categoria_principal_id?: string | null
          categoria_secundaria_1_id?: string | null
          categoria_secundaria_2_id?: string | null
          cidade?: string | null
          criado_em?: string
          descricao?: string | null
          enviada_em?: string | null
          foto_path?: string | null
          id?: string
          item_id?: string
          nome?: string | null
          preco_centavos?: number | null
          preco_modo?: string | null
          situacao?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_item_versao_categoria_principal_id_fkey"
            columns: ["categoria_principal_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_categoria_secundaria_1_id_fkey"
            columns: ["categoria_secundaria_1_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_categoria_secundaria_2_id_fkey"
            columns: ["categoria_secundaria_2_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_meus_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_conta: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          nome_exibicao: string | null
          whatsapp_e164: string | null
          whatsapp_verificado: boolean
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id: string
          nome_exibicao?: string | null
          whatsapp_e164?: string | null
          whatsapp_verificado?: boolean
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome_exibicao?: string | null
          whatsapp_e164?: string | null
          whatsapp_verificado?: boolean
        }
        Relationships: []
      }
      contas_whatsapp_historico: {
        Row: {
          alterado_em: string
          autor_id: string | null
          conta_id: string
          id: number
          whatsapp_anterior_e164: string | null
          whatsapp_novo_e164: string | null
        }
        Insert: {
          alterado_em?: string
          autor_id?: string | null
          conta_id: string
          id?: never
          whatsapp_anterior_e164?: string | null
          whatsapp_novo_e164?: string | null
        }
        Update: {
          alterado_em?: string
          autor_id?: string | null
          conta_id?: string
          id?: never
          whatsapp_anterior_e164?: string | null
          whatsapp_novo_e164?: string | null
        }
        Relationships: []
      }
      indicacoes_evento: {
        Row: {
          canal: string | null
          criado_em: string
          id: number
          link_id: string | null
          pedido_id: string | null
          tipo: string
        }
        Insert: {
          canal?: string | null
          criado_em?: string
          id?: never
          link_id?: string | null
          pedido_id?: string | null
          tipo: string
        }
        Update: {
          canal?: string | null
          criado_em?: string
          id?: never
          link_id?: string | null
          pedido_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_evento_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_evento_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_evento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_evento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_evento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_evento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes_link: {
        Row: {
          codigo: string
          criado_em: string
          id: string
          indicador_id: string
          item_id: string | null
          perfil_id: string | null
        }
        Insert: {
          codigo: string
          criado_em?: string
          id?: string
          indicador_id: string
          item_id?: string | null
          perfil_id?: string | null
        }
        Update: {
          codigo?: string
          criado_em?: string
          id?: string
          indicador_id?: string
          item_id?: string | null
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_link_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_link_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_link_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_link_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_meus_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_link_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_link_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_link_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes_notificacao: {
        Row: {
          alerta_estado: string
          atualizado_em: string
          estado: string
          pedido_id: string
          reenvio_solicitado_em: string | null
          tentativas: number
          ultima_tentativa_em: string | null
          ultimo_erro: string | null
        }
        Insert: {
          alerta_estado?: string
          atualizado_em?: string
          estado?: string
          pedido_id: string
          reenvio_solicitado_em?: string | null
          tentativas?: number
          ultima_tentativa_em?: string | null
          ultimo_erro?: string | null
        }
        Update: {
          alerta_estado?: string
          atualizado_em?: string
          estado?: string
          pedido_id?: string
          reenvio_solicitado_em?: string | null
          tentativas?: number
          ultima_tentativa_em?: string | null
          ultimo_erro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_notificacao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_notificacao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_notificacao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_notificacao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes_notificacao_historico: {
        Row: {
          criado_em: string
          erro: string | null
          evento: string
          id: number
          origem: string
          pedido_id: string
        }
        Insert: {
          criado_em?: string
          erro?: string | null
          evento: string
          id?: never
          origem: string
          pedido_id: string
        }
        Update: {
          criado_em?: string
          erro?: string | null
          evento?: string
          id?: never
          origem?: string
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_notificacao_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_notificacao_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_notificacao_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_notificacao_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes_parametro: {
        Row: {
          atualizado_em: string
          chave: string
          descricao: string
          maximo: number
          minimo: number
          valor: number
        }
        Insert: {
          atualizado_em?: string
          chave: string
          descricao: string
          maximo: number
          minimo: number
          valor: number
        }
        Update: {
          atualizado_em?: string
          chave?: string
          descricao?: string
          maximo?: number
          minimo?: number
          valor?: number
        }
        Relationships: []
      }
      indicacoes_pedido_contato: {
        Row: {
          autoindicacao_suspeita: boolean
          chave_idempotencia: string
          criado_em: string
          email: string | null
          id: string
          item_id: string | null
          link_id: string | null
          mensagem: string | null
          nome: string
          perfil_id: string | null
          solicitante_id: string | null
          whatsapp_e164: string
        }
        Insert: {
          autoindicacao_suspeita?: boolean
          chave_idempotencia: string
          criado_em?: string
          email?: string | null
          id?: string
          item_id?: string | null
          link_id?: string | null
          mensagem?: string | null
          nome: string
          perfil_id?: string | null
          solicitante_id?: string | null
          whatsapp_e164: string
        }
        Update: {
          autoindicacao_suspeita?: boolean
          chave_idempotencia?: string
          criado_em?: string
          email?: string | null
          id?: string
          item_id?: string | null
          link_id?: string | null
          mensagem?: string | null
          nome?: string
          perfil_id?: string | null
          solicitante_id?: string | null
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_pedido_contato_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_meus_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_pedido_contato_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_perfil: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          publicado: boolean
          responsavel_id: string
          slug: string
          versao_aprovada_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          publicado?: boolean
          responsavel_id: string
          slug: string
          versao_aprovada_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          publicado?: boolean
          responsavel_id?: string
          slug?: string
          versao_aprovada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_perfil_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_aprovada_fk"
            columns: ["versao_aprovada_id", "id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_versao"
            referencedColumns: ["id", "perfil_id"]
          },
        ]
      }
      perfis_perfil_versao: {
        Row: {
          areas_atendidas: string[]
          banners_paths: string[]
          categoria_principal_id: string | null
          categoria_secundaria_1_id: string | null
          categoria_secundaria_2_id: string | null
          cidade: string | null
          criado_em: string
          descricao_breve: string | null
          endereco: string | null
          enviada_em: string | null
          fotos_paths: string[]
          id: string
          imagem_path: string | null
          informacoes_sociais: string | null
          nome: string | null
          perfil_id: string
          site: string | null
          situacao: string
          uf: string | null
        }
        Insert: {
          areas_atendidas?: string[]
          banners_paths?: string[]
          categoria_principal_id?: string | null
          categoria_secundaria_1_id?: string | null
          categoria_secundaria_2_id?: string | null
          cidade?: string | null
          criado_em?: string
          descricao_breve?: string | null
          endereco?: string | null
          enviada_em?: string | null
          fotos_paths?: string[]
          id?: string
          imagem_path?: string | null
          informacoes_sociais?: string | null
          nome?: string | null
          perfil_id: string
          site?: string | null
          situacao?: string
          uf?: string | null
        }
        Update: {
          areas_atendidas?: string[]
          banners_paths?: string[]
          categoria_principal_id?: string | null
          categoria_secundaria_1_id?: string | null
          categoria_secundaria_2_id?: string | null
          cidade?: string | null
          criado_em?: string
          descricao_breve?: string | null
          endereco?: string | null
          enviada_em?: string | null
          fotos_paths?: string[]
          id?: string
          imagem_path?: string | null
          informacoes_sociais?: string | null
          nome?: string | null
          perfil_id?: string
          site?: string | null
          situacao?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_perfil_versao_categoria_principal_id_fkey"
            columns: ["categoria_principal_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_categoria_secundaria_1_id_fkey"
            columns: ["categoria_secundaria_1_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_categoria_secundaria_2_id_fkey"
            columns: ["categoria_secundaria_2_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_perfil_versao_contato: {
        Row: {
          versao_id: string
          whatsapp_comercial_e164: string
        }
        Insert: {
          versao_id: string
          whatsapp_comercial_e164: string
        }
        Update: {
          versao_id?: string
          whatsapp_comercial_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_perfil_versao_contato_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "perfis_perfil_versao"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_revisao: {
        Row: {
          autor_id: string
          decidida_em: string
          decisao: string
          id: string
          motivo: string | null
          perfil_id: string
          versao_aprovada_anterior_id: string | null
          versao_id: string
        }
        Insert: {
          autor_id: string
          decidida_em?: string
          decisao: string
          id?: string
          motivo?: string | null
          perfil_id: string
          versao_aprovada_anterior_id?: string | null
          versao_id: string
        }
        Update: {
          autor_id?: string
          decidida_em?: string
          decisao?: string
          id?: string
          motivo?: string | null
          perfil_id?: string
          versao_aprovada_anterior_id?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_revisao_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_revisao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_revisao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_revisao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_revisao_versao_aprovada_anterior_id_fkey"
            columns: ["versao_aprovada_anterior_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_versao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_revisao_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "perfis_perfil_versao"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_beneficio: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          perfil_id: string
          versao_aprovada_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          perfil_id: string
          versao_aprovada_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          perfil_id?: string
          versao_aprovada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_versao_aprovada_fk"
            columns: ["versao_aprovada_id", "id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_beneficios"
            referencedColumns: ["versao_id", "beneficio_id"]
          },
          {
            foreignKeyName: "pontos_beneficio_versao_aprovada_fk"
            columns: ["versao_aprovada_id", "id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio_versao"
            referencedColumns: ["id", "beneficio_id"]
          },
        ]
      }
      pontos_beneficio_revisao: {
        Row: {
          autor_id: string
          beneficio_id: string
          decidida_em: string
          decisao: string
          id: string
          motivo: string | null
          versao_aprovada_anterior_id: string | null
          versao_id: string
        }
        Insert: {
          autor_id: string
          beneficio_id: string
          decidida_em?: string
          decisao: string
          id?: string
          motivo?: string | null
          versao_aprovada_anterior_id?: string | null
          versao_id: string
        }
        Update: {
          autor_id?: string
          beneficio_id?: string
          decidida_em?: string
          decisao?: string
          id?: string
          motivo?: string | null
          versao_aprovada_anterior_id?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_beneficio_revisao_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_revisao_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_revisao_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_revisao_versao_aprovada_anterior_id_fkey"
            columns: ["versao_aprovada_anterior_id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_beneficios"
            referencedColumns: ["versao_id"]
          },
          {
            foreignKeyName: "pontos_beneficio_revisao_versao_aprovada_anterior_id_fkey"
            columns: ["versao_aprovada_anterior_id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio_versao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_revisao_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "administracao_fila_beneficios"
            referencedColumns: ["versao_id"]
          },
          {
            foreignKeyName: "pontos_beneficio_revisao_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "pontos_beneficio_versao"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_beneficio_versao: {
        Row: {
          beneficio_id: string
          condicoes: string | null
          criado_em: string
          descricao: string | null
          enviada_em: string | null
          id: string
          limite_por_pessoa: number | null
          limite_total: number | null
          nome: string | null
          pontos_necessarios: number | null
          prazo_resgate_ate: string | null
          prazo_uso_ate: string | null
          situacao: string
        }
        Insert: {
          beneficio_id: string
          condicoes?: string | null
          criado_em?: string
          descricao?: string | null
          enviada_em?: string | null
          id?: string
          limite_por_pessoa?: number | null
          limite_total?: number | null
          nome?: string | null
          pontos_necessarios?: number | null
          prazo_resgate_ate?: string | null
          prazo_uso_ate?: string | null
          situacao?: string
        }
        Update: {
          beneficio_id?: string
          condicoes?: string | null
          criado_em?: string
          descricao?: string | null
          enviada_em?: string | null
          id?: string
          limite_por_pessoa?: number | null
          limite_total?: number | null
          nome?: string | null
          pontos_necessarios?: number | null
          prazo_resgate_ate?: string | null
          prazo_uso_ate?: string | null
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_beneficio_versao_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_versao_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_decisao: {
        Row: {
          chave_hash: string
          decidido_em: string
          destino_ref_id: string
          destino_ref_tipo: string
          id: number
          indicador_id: string | null
          intervalo_dias: number
          link_id: string | null
          motivo: string
          pedido_criado_em: string
          pedido_id: string
          pontos: number
          pontuado: boolean
        }
        Insert: {
          chave_hash: string
          decidido_em?: string
          destino_ref_id: string
          destino_ref_tipo: string
          id?: never
          indicador_id?: string | null
          intervalo_dias: number
          link_id?: string | null
          motivo: string
          pedido_criado_em: string
          pedido_id: string
          pontos?: number
          pontuado: boolean
        }
        Update: {
          chave_hash?: string
          decidido_em?: string
          destino_ref_id?: string
          destino_ref_tipo?: string
          id?: never
          indicador_id?: string | null
          intervalo_dias?: number
          link_id?: string | null
          motivo?: string
          pedido_criado_em?: string
          pedido_id?: string
          pontos?: number
          pontuado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pontos_decisao_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_falha: {
        Row: {
          criado_em: string
          erro: string
          id: number
          pedido_id: string
        }
        Insert: {
          criado_em?: string
          erro: string
          id?: never
          pedido_id: string
        }
        Update: {
          criado_em?: string
          erro?: string
          id?: never
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_lancamento: {
        Row: {
          autor_id: string | null
          confirmou_saldo_negativo: boolean
          criado_em: string
          destino_item_id: string | null
          destino_nome: string
          destino_perfil_id: string | null
          id: string
          indicador_id: string
          motivo: string | null
          original_id: string | null
          pedido_id: string | null
          pontos: number
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          confirmou_saldo_negativo?: boolean
          criado_em?: string
          destino_item_id?: string | null
          destino_nome: string
          destino_perfil_id?: string | null
          id?: string
          indicador_id: string
          motivo?: string | null
          original_id?: string | null
          pedido_id?: string | null
          pontos: number
          tipo: string
        }
        Update: {
          autor_id?: string | null
          confirmou_saldo_negativo?: boolean
          criado_em?: string
          destino_item_id?: string | null
          destino_nome?: string
          destino_perfil_id?: string | null
          id?: string
          indicador_id?: string
          motivo?: string | null
          original_id?: string | null
          pedido_id?: string | null
          pontos?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_lancamento_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_destino_item_id_fkey"
            columns: ["destino_item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_destino_item_id_fkey"
            columns: ["destino_item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_destino_item_id_fkey"
            columns: ["destino_item_id"]
            isOneToOne: false
            referencedRelation: "catalogo_meus_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_destino_perfil_id_fkey"
            columns: ["destino_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_destino_perfil_id_fkey"
            columns: ["destino_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_destino_perfil_id_fkey"
            columns: ["destino_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "contas_conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_original_fk"
            columns: ["original_id", "indicador_id"]
            isOneToOne: false
            referencedRelation: "pontos_lancamento"
            referencedColumns: ["id", "indicador_id"]
          },
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_parametro: {
        Row: {
          atualizado_em: string
          chave: string
          descricao: string
          maximo: number
          minimo: number
          valor: number
        }
        Insert: {
          atualizado_em?: string
          chave: string
          descricao: string
          maximo: number
          minimo: number
          valor: number
        }
        Update: {
          atualizado_em?: string
          chave?: string
          descricao?: string
          maximo?: number
          minimo?: number
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      administracao_consulta_negocios: {
        Row: {
          alvo_id: string | null
          alvo_tipo: string | null
          atualizado_em: string | null
          categoria: string | null
          cidade: string | null
          criado_em: string | null
          disponivel: boolean | null
          dono_id: string | null
          item_tipo: string | null
          nome: string | null
          perfil_id: string | null
          publicado: boolean | null
          situacao: string | null
          slug: string | null
          tem_versao_aprovada: boolean | null
          uf: string | null
          versao_id: string | null
        }
        Relationships: []
      }
      administracao_fila_beneficios: {
        Row: {
          beneficio_id: string | null
          eh_edicao: boolean | null
          enviada_em: string | null
          nome: string | null
          perfil_id: string | null
          versao_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_versao_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_versao_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "pontos_beneficio_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      administracao_fila_contatos: {
        Row: {
          alerta_estado: string | null
          autoindicacao_suspeita: boolean | null
          criado_em: string | null
          destino_id: string | null
          destino_nome: string | null
          destino_tipo: string | null
          email: string | null
          id: string | null
          mensagem: string | null
          nome: string | null
          notificacao_estado: string | null
          reenvio_solicitado_em: string | null
          tentativas: number | null
          ultima_tentativa_em: string | null
          ultimo_erro: string | null
          veio_por_indicacao: boolean | null
          whatsapp_e164: string | null
        }
        Relationships: []
      }
      administracao_fila_pendencias: {
        Row: {
          alvo_id: string | null
          alvo_tipo: string | null
          dono_id: string | null
          eh_edicao: boolean | null
          enviada_em: string | null
          nome: string | null
          versao_id: string | null
        }
        Relationships: []
      }
      administracao_meus_resultados: {
        Row: {
          alvo_id: string | null
          autor_ref: string | null
          decidida_em: string | null
          enviada_em: string | null
          motivo: string | null
          nome: string | null
          publicado: boolean | null
          situacao: string | null
          slug: string | null
          tipo: string | null
          versao_id: string | null
          versao_vigente: boolean | null
        }
        Relationships: []
      }
      administracao_patrocinador_publico: {
        Row: {
          destino_perfil_id: string | null
          destino_perfil_slug: string | null
          destino_texto: string | null
          destino_tipo: string | null
          id: string | null
          identificacao: string | null
          imagem_path: string | null
          ordem: number | null
          titulo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administracao_patrocinador_perfil_destino_id_fkey"
            columns: ["destino_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracao_patrocinador_perfil_destino_id_fkey"
            columns: ["destino_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "administracao_patrocinador_perfil_destino_id_fkey"
            columns: ["destino_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      administracao_pontos_decisoes: {
        Row: {
          decidido_em: string | null
          destino_id: string | null
          destino_tipo: string | null
          id: number | null
          indicador_ref: string | null
          intervalo_dias: number | null
          motivo: string | null
          pedido_criado_em: string | null
          pedido_id: string | null
          pontos: number | null
          pontuado: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_decisao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      administracao_pontos_falhas: {
        Row: {
          falhas: number | null
          pedido_id: string | null
          pendente: boolean | null
          ultima_falha_em: string | null
          ultimo_erro: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_falha_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      administracao_pontos_lancamentos: {
        Row: {
          confirmou_saldo_negativo: boolean | null
          criado_em: string | null
          destino_id: string | null
          destino_nome: string | null
          destino_tipo: string | null
          id: string | null
          indicador_ref: string | null
          motivo: string | null
          original_id: string | null
          pedido_id: string | null
          pontos: number | null
          situacao: string | null
          tipo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "administracao_fila_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_meus_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_minhas_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_lancamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "indicacoes_pedido_contato"
            referencedColumns: ["id"]
          },
        ]
      }
      administracao_pontos_saldos: {
        Row: {
          indicador_ref: string | null
          saldo: number | null
          total_creditado: number | null
          total_revertido: number | null
          ultimo_lancamento_em: string | null
        }
        Relationships: []
      }
      catalogo_item_publico: {
        Row: {
          categoria_principal_id: string | null
          categoria_secundaria_1_id: string | null
          categoria_secundaria_2_id: string | null
          cidade: string | null
          criado_em: string | null
          descricao: string | null
          foto_path: string | null
          id: string | null
          nome: string | null
          perfil_id: string | null
          preco_centavos: number | null
          preco_modo: string | null
          tipo: string | null
          uf: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_item_versao_categoria_principal_id_fkey"
            columns: ["categoria_principal_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_categoria_secundaria_1_id_fkey"
            columns: ["categoria_secundaria_1_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_item_versao_categoria_secundaria_2_id_fkey"
            columns: ["categoria_secundaria_2_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_meus_itens: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string | null
          perfil_id: string | null
          publicado: boolean | null
          tipo: string | null
          versao_aprovada_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string | null
          perfil_id?: string | null
          publicado?: boolean | null
          tipo?: string | null
          versao_aprovada_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string | null
          perfil_id?: string | null
          publicado?: boolean | null
          tipo?: string | null
          versao_aprovada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_item_versao_aprovada_fk"
            columns: ["versao_aprovada_id", "id"]
            isOneToOne: false
            referencedRelation: "catalogo_item_versao"
            referencedColumns: ["id", "item_id"]
          },
        ]
      }
      indicacoes_meus_links: {
        Row: {
          codigo: string | null
          criado_em: string | null
          destino_id: string | null
          destino_nome: string | null
          destino_tipo: string | null
          disponivel: boolean | null
          id: string | null
        }
        Relationships: []
      }
      indicacoes_meus_pedidos: {
        Row: {
          criado_em: string | null
          destino_id: string | null
          destino_nome: string | null
          destino_tipo: string | null
          email: string | null
          id: string | null
          mensagem: string | null
          nome: string | null
          notificacao_estado: string | null
          veio_por_indicacao: boolean | null
          whatsapp_e164: string | null
        }
        Relationships: []
      }
      indicacoes_minhas_indicacoes: {
        Row: {
          criado_em: string | null
          destino_id: string | null
          destino_nome: string | null
          destino_tipo: string | null
          id: string | null
          status: string | null
        }
        Relationships: []
      }
      perfis_meus_perfis: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string | null
          publicado: boolean | null
          slug: string | null
          versao_aprovada_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string | null
          publicado?: boolean | null
          slug?: string | null
          versao_aprovada_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string | null
          publicado?: boolean | null
          slug?: string | null
          versao_aprovada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_perfil_versao_aprovada_fk"
            columns: ["versao_aprovada_id", "id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_versao"
            referencedColumns: ["id", "perfil_id"]
          },
        ]
      }
      perfis_perfil_publico: {
        Row: {
          areas_atendidas: string[] | null
          banners_paths: string[] | null
          categoria_principal_id: string | null
          categoria_secundaria_1_id: string | null
          categoria_secundaria_2_id: string | null
          cidade: string | null
          descricao_breve: string | null
          endereco: string | null
          fotos_paths: string[] | null
          id: string | null
          imagem_path: string | null
          informacoes_sociais: string | null
          nome: string | null
          site: string | null
          slug: string | null
          uf: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_perfil_versao_categoria_principal_id_fkey"
            columns: ["categoria_principal_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_categoria_secundaria_1_id_fkey"
            columns: ["categoria_secundaria_1_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_perfil_versao_categoria_secundaria_2_id_fkey"
            columns: ["categoria_secundaria_2_id"]
            isOneToOne: false
            referencedRelation: "catalogo_categoria"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_beneficio_publico: {
        Row: {
          condicoes: string | null
          criado_em: string | null
          descricao: string | null
          id: string | null
          limite_por_pessoa: number | null
          limite_total: number | null
          nome: string | null
          perfil_id: string | null
          pontos_necessarios: number | null
          prazo_resgate_ate: string | null
          prazo_uso_ate: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_meus_perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontos_beneficio_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_perfil_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_meu_saldo: {
        Row: {
          saldo: number | null
          total_creditado: number | null
          total_revertido: number | null
          ultimo_lancamento_em: string | null
        }
        Relationships: []
      }
      pontos_meus_lancamentos: {
        Row: {
          criado_em: string | null
          destino_id: string | null
          destino_nome: string | null
          destino_tipo: string | null
          id: string | null
          motivo: string | null
          original_id: string | null
          pontos: number | null
          situacao: string | null
          tipo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      administracao_alterar_patrocinador: {
        Args: {
          p_fim_em: string
          p_id: string
          p_imagem_path: string
          p_inicio_em: string
          p_motivo: string
          p_ordem: number
          p_perfil_destino_id: string
          p_texto_destino: string
          p_titulo: string
        }
        Returns: undefined
      }
      administracao_criar_patrocinador: {
        Args: {
          p_ativo?: boolean
          p_fim_em?: string
          p_id?: string
          p_imagem_path: string
          p_inicio_em?: string
          p_motivo?: string
          p_ordem?: number
          p_perfil_destino_id?: string
          p_texto_destino?: string
          p_titulo: string
        }
        Returns: string
      }
      administracao_definir_patrocinador_ativo: {
        Args: { p_ativo: boolean; p_id: string; p_motivo: string }
        Returns: undefined
      }
      administracao_eh_admin: { Args: never; Returns: boolean }
      administracao_exigir_admin: { Args: never; Returns: string }
      busca_normalizar: { Args: { p_texto: string }; Returns: string }
      busca_publica: {
        Args: {
          p_categoria_id?: string
          p_cidade?: string
          p_limite?: number
          p_pagina?: number
          p_termo?: string
          p_tipo?: string
          p_uf?: string
        }
        Returns: {
          o_categoria_id: string
          o_categoria_nome: string
          o_categoria_slug: string
          o_cidade: string
          o_descricao: string
          o_id: string
          o_imagem_path: string
          o_nome: string
          o_perfil_id: string
          o_perfil_slug: string
          o_preco_centavos: number
          o_preco_modo: string
          o_slug: string
          o_tipo: string
          o_total: number
          o_uf: string
        }[]
      }
      catalogo_alterar_categoria: {
        Args: {
          p_ativa: boolean
          p_id: string
          p_motivo: string
          p_nome: string
          p_ordem: number
        }
        Returns: undefined
      }
      catalogo_criar_categoria: {
        Args: { p_nome: string; p_ordem?: number; p_slug: string }
        Returns: string
      }
      catalogo_criar_item: {
        Args: {
          p_categoria_principal_id?: string
          p_categoria_secundaria_1_id?: string
          p_categoria_secundaria_2_id?: string
          p_cidade?: string
          p_descricao?: string
          p_nome?: string
          p_perfil_id?: string
          p_preco_centavos?: number
          p_preco_modo?: string
          p_tipo: string
          p_uf?: string
        }
        Returns: {
          o_item_id: string
          o_versao_id: string
        }[]
      }
      catalogo_decidir_item_versao: {
        Args: { p_aprovar: boolean; p_motivo?: string; p_versao_id: string }
        Returns: undefined
      }
      catalogo_decidir_solicitacao: {
        Args: {
          p_atendida: boolean
          p_categoria_id?: string
          p_id: string
          p_motivo: string
        }
        Returns: undefined
      }
      catalogo_eh_dono: { Args: { p_item_id: string }; Returns: boolean }
      catalogo_eh_dono_da_versao: {
        Args: { p_versao_id: string }
        Returns: boolean
      }
      catalogo_enviar_item_versao: {
        Args: { p_versao_id: string }
        Returns: undefined
      }
      catalogo_imagem_em_uso: { Args: { p_nome: string }; Returns: boolean }
      catalogo_imagem_publica: { Args: { p_nome: string }; Returns: boolean }
      catalogo_imagens_da_conta: { Args: never; Returns: number }
      catalogo_pasta_do_dono: { Args: { p_nome: string }; Returns: boolean }
      contas_pode_indicar: { Args: never; Returns: boolean }
      indicacoes_definir_parametro: {
        Args: { p_chave: string; p_motivo: string; p_valor: number }
        Returns: undefined
      }
      indicacoes_eh_responsavel_do_pedido: {
        Args: { p_pedido_id: string }
        Returns: boolean
      }
      indicacoes_enviar_contato: {
        Args: {
          p_chave: string
          p_codigo?: string
          p_email?: string
          p_item_id: string
          p_mensagem?: string
          p_nome: string
          p_perfil_id: string
          p_whatsapp: string
        }
        Returns: {
          o_pedido_id: string
          o_repetido: boolean
          o_whatsapp_responsavel: string
        }[]
      }
      indicacoes_gerar_link: {
        Args: { p_item_id?: string; p_perfil_id?: string }
        Returns: {
          o_codigo: string
          o_novo: boolean
        }[]
      }
      indicacoes_notificacao_registrar: {
        Args: { p_erro?: string; p_pedido_id: string; p_sucesso: boolean }
        Returns: undefined
      }
      indicacoes_notificacoes_pendentes: {
        Args: { p_limite?: number }
        Returns: {
          o_destino_nome: string
          o_destino_tipo: string
          o_email_responsavel: string
          o_pedido_id: string
          o_tentativas: number
        }[]
      }
      indicacoes_parametro_valor: { Args: { p_chave: string }; Returns: number }
      indicacoes_registrar_compartilhamento: {
        Args: { p_canal: string; p_codigo: string }
        Returns: undefined
      }
      indicacoes_resolver_destino: {
        Args: { p_item_id: string; p_perfil_id: string }
        Returns: {
          o_disponivel: boolean
          o_dono_id: string
          o_nome: string
          o_whatsapp: string
        }[]
      }
      indicacoes_solicitar_reenvio: {
        Args: { p_motivo?: string; p_pedido_id: string }
        Returns: undefined
      }
      indicacoes_tratar_alerta: {
        Args: { p_motivo: string; p_pedido_id: string }
        Returns: undefined
      }
      perfis_criar_rascunho: {
        Args: {
          p_areas_atendidas?: string[]
          p_categoria_principal_id?: string
          p_categoria_secundaria_1_id?: string
          p_categoria_secundaria_2_id?: string
          p_cidade?: string
          p_descricao_breve?: string
          p_endereco?: string
          p_informacoes_sociais?: string
          p_nome?: string
          p_site?: string
          p_slug: string
          p_uf?: string
          p_whatsapp_comercial: string
        }
        Returns: {
          o_perfil_id: string
          o_versao_id: string
        }[]
      }
      perfis_decidir_versao: {
        Args: { p_aprovar: boolean; p_motivo?: string; p_versao_id: string }
        Returns: undefined
      }
      perfis_eh_dono: { Args: { p_perfil_id: string }; Returns: boolean }
      perfis_eh_dono_da_versao: {
        Args: { p_versao_id: string }
        Returns: boolean
      }
      perfis_enviar_versao: {
        Args: { p_versao_id: string }
        Returns: undefined
      }
      perfis_gravar_versao: {
        Args: {
          p_areas_atendidas?: string[]
          p_banners_paths?: string[]
          p_categoria_principal_id?: string
          p_categoria_secundaria_1_id?: string
          p_categoria_secundaria_2_id?: string
          p_cidade?: string
          p_descricao_breve?: string
          p_endereco?: string
          p_fotos_paths?: string[]
          p_imagem_path?: string
          p_informacoes_sociais?: string
          p_nome?: string
          p_perfil_id: string
          p_site?: string
          p_uf?: string
          p_whatsapp_comercial: string
        }
        Returns: string
      }
      perfis_perfil_disponivel: {
        Args: { p_perfil_id: string }
        Returns: boolean
      }
      pontos_admin_cadastrar_beneficio: {
        Args: {
          p_condicoes?: string
          p_descricao: string
          p_limite_por_pessoa?: number
          p_limite_total?: number
          p_motivo: string
          p_nome: string
          p_perfil_id: string
          p_pontos_necessarios: number
          p_prazo_resgate_ate?: string
          p_prazo_uso_ate?: string
        }
        Returns: {
          o_beneficio_id: string
          o_versao_id: string
        }[]
      }
      pontos_admin_definir_beneficio_ativo: {
        Args: { p_ativo: boolean; p_beneficio_id: string; p_motivo: string }
        Returns: undefined
      }
      pontos_avaliar_pedido: { Args: { p_pedido_id: string }; Returns: number }
      pontos_criar_beneficio: {
        Args: {
          p_condicoes?: string
          p_descricao: string
          p_limite_por_pessoa?: number
          p_limite_total?: number
          p_nome: string
          p_perfil_id: string
          p_pontos_necessarios: number
          p_prazo_resgate_ate?: string
          p_prazo_uso_ate?: string
        }
        Returns: {
          o_beneficio_id: string
          o_versao_id: string
        }[]
      }
      pontos_decidir_beneficio_versao: {
        Args: { p_aprovar: boolean; p_motivo?: string; p_versao_id: string }
        Returns: undefined
      }
      pontos_definir_beneficio_ativo: {
        Args: { p_ativo: boolean; p_beneficio_id: string }
        Returns: undefined
      }
      pontos_definir_parametro: {
        Args: { p_chave: string; p_motivo: string; p_valor: number }
        Returns: undefined
      }
      pontos_eh_dono_beneficio: {
        Args: { p_beneficio_id: string }
        Returns: boolean
      }
      pontos_enviar_beneficio_versao: {
        Args: { p_versao_id: string }
        Returns: undefined
      }
      pontos_parametro_valor: { Args: { p_chave: string }; Returns: number }
      pontos_parametros_atuais: {
        Args: never
        Returns: {
          o_intervalo_dias: number
          o_pontos_por_indicacao: number
        }[]
      }
      pontos_reprocessar_pedido: {
        Args: { p_motivo: string; p_pedido_id: string }
        Returns: number
      }
      pontos_reprocessar_pendentes: {
        Args: { p_limite?: number }
        Returns: number
      }
      pontos_reverter_credito: {
        Args: {
          p_confirmar_saldo_negativo?: boolean
          p_lancamento_id: string
          p_motivo: string
        }
        Returns: string
      }
      pontos_salvar_beneficio: {
        Args: {
          p_beneficio_id: string
          p_condicoes?: string
          p_descricao: string
          p_limite_por_pessoa?: number
          p_limite_total?: number
          p_nome: string
          p_pontos_necessarios: number
          p_prazo_resgate_ate?: string
          p_prazo_uso_ate?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
