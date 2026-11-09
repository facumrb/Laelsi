import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  effect,
  untracked,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IApiClient, UserStateFilter } from '@models/user.model';
import { ApiClientService } from '@services/api-services/api-client.service';
import { AlertService } from '@services/alert.service';
import { ClientsToolbarComponent } from './clients-toolbar/clients-toolbar.component';
import { FiscalConditionFilter } from './clients-toolbar/components/clients-filter-button/clients-filter-button.component';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ConfirmDeleteModalComponent } from '@admin/components/confirm-delete-modal/confirm-delete-modal.component';

@Component({
  selector: 'app-clients-page',
  imports: [
    ClientsListComponent,
    ClientsToolbarComponent,
    PaginationComponent,
    ConfirmDeleteModalComponent,
  ],
  templateUrl: './clients-page.component.html',
})
export class ClientsPageComponent implements OnInit {
  private alertService = inject(AlertService);
  private apiService = inject(ApiClientService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  private clientsRaw = signal<IApiClient[]>([]);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  clientToDelete = signal<IApiClient | null>(null);

  searchQuery = signal<string>('');
  fiscalFilter = signal<FiscalConditionFilter>('Todos');
  stateFilter = signal<UserStateFilter>('Todos');

  filtersActive = computed(() => {
    return (
      this.searchQuery() !== '' ||
      this.fiscalFilter() !== 'Todos' ||
      this.stateFilter() !== 'Todos'
    );
  });

  clientsFiltered = computed(() => {
    // El filtrado se hace server-side (búsqueda + condición fiscal).
    return [...this.clientsRaw()].sort((a, b) => a.id - b.id);
  });

  constructor() {
    // Reacciona cuando el usuario cambia la búsqueda, el filtro fiscal o el de estado.
    // Todos los filtros se aplican server-side con paginación correcta.
    effect(() => {
      this.searchQuery();
      this.fiscalFilter();
      this.stateFilter();
      untracked(() => {
        // La primera ejecución del efecto no es un cambio de filtro: ngOnInit ya carga la lista. Antes se la
        // pedía dos veces al abrir la página (dos invocaciones por visita).
        if (this.efectoYaCorrio) {
          this.currentPage.set(1);
          this.loadClients();
        }
        this.efectoYaCorrio = true;
      });
    });
  }

  private efectoYaCorrio = false;

  ngOnInit() {
    const pageParam = this.route.snapshot.queryParamMap.get('page');
    this.currentPage.set(Number(pageParam) || 1);
    this.loadClients();
  }

  loadClients() {
    const query = this.searchQuery().trim();
    const fiscal = this.fiscalFilter();
    const state = this.stateFilter();

    // Si hay búsqueda, usamos el endpoint de search
    if (query) {
      this.apiService.searchClients(query, this.currentPage(), 16, state).subscribe({
        next: (data) => {
          this.clientsRaw.set(data.data);
          this.totalPages.set(data.totalPages);
        },
      });
    } else {
      // Usamos getAll con el filtro fiscal y el de estado (server-side)
      this.apiService.getAllClients(this.currentPage(), 16, fiscal, state).subscribe({
        next: (data) => {
          this.clientsRaw.set(data.data);
          this.totalPages.set(data.totalPages);
        },
      });
    }
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
    this.loadClients();
  }

  handleNavigateToCreate() {
    this.router.navigate(['/admin/clients/create']);
  }

  handleNavigateToEdit(client: IApiClient) {
    this.router.navigate(['/admin/clients/edit', client.id]);
  }

  handleDelete(client: IApiClient) {
    this.clientToDelete.set(client);
  }

  // ID 65 de docs/requerimientos/discusiones.md: no se elimina a ningún cliente, solo se lo desactiva.
  // Conserva sus datos y su historial de pedidos; no puede ingresar ni hacer pedidos hasta reactivarlo.
  confirmDeactivateClient() {
    const client = this.clientToDelete();
    if (!client) return;

    this.apiService.setClientState(client.id, 'Inactivo').subscribe({
      next: () => {
        this.alertService.toast('Cliente desactivado', 'success');
        this.clientToDelete.set(null);
        // Recargamos desde el servidor para que la paginación y el filtro de estado se recalculen
        this.loadClients();
      },
    });
  }

  reactivateClient(client: IApiClient) {
    this.apiService.setClientState(client.id, 'Activo').subscribe({
      next: () => {
        this.alertService.toast('Cliente reactivado', 'success');
        this.loadClients();
      },
    });
  }
}
