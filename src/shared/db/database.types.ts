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
