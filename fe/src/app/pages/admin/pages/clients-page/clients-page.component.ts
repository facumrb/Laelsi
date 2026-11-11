import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IApiClient, UserStateFilter } from '@models/user.model';
import { AlertService } from '@services/alert.service';
import { ClientsToolbarComponent } from './clients-toolbar/clients-toolbar.component';
import { FiscalConditionFilter } from './clients-toolbar/components/clients-filter-button/clients-filter-button.component';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ConfirmDeleteModalComponent } from '@admin/components/confirm-delete-modal/confirm-delete-modal.component';
import {
  injectAllClientsQuery,
  injectSetClientStateMutation,
} from '@services/queries/client-queries';

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
export class ClientsPageComponent {
  private alertService = inject(AlertService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  clientToDelete = signal<IApiClient | null>(null);

  searchQuery = signal<string>('');
  fiscalFilter = signal<FiscalConditionFilter>('Todos');
  stateFilter = signal<UserStateFilter>('Todos');

  // Al cambiar un filtro se vuelve a la página 1; la primera vez se toma la página de la URL.
  // La página forma parte de la queryKey, así que TanStack Query pide los datos solo.
  currentPage = linkedSignal<unknown, number>({
    source: () => [this.searchQuery(), this.fiscalFilter(), this.stateFilter()],
    computation: (_filters, previous) =>
      previous ? 1 : Number(this.route.snapshot.queryParamMap.get('page')) || 1,
  });

  private activeFilters = computed(() => ({
    query: this.searchQuery(),
    fiscalCondition: this.fiscalFilter(),
    state: this.stateFilter(),
    page: this.currentPage(),
    limit: 16,
  }));

  private clientsQuery = injectAllClientsQuery(this.activeFilters);
  private setStateMutation = injectSetClientStateMutation();

  // Solo es true cuando no hay ningún dato que mostrar: con datos anteriores en caché se siguen viendo
  loading = computed(() => this.clientsQuery.isPending());
  totalPages = computed(() => this.clientsQuery.data()?.totalPages ?? 1);

  filtersActive = computed(() => {
    return (
      this.searchQuery() !== '' ||
      this.fiscalFilter() !== 'Todos' ||
      this.stateFilter() !== 'Todos'
    );
  });

  clientsFiltered = computed(() =>
    [...(this.clientsQuery.data()?.data ?? [])].sort((a, b) => a.id - b.id),
  );

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
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

  // Conserva sus datos y su historial de pedidos; no puede ingresar ni hacer pedidos hasta reactivarlo.
  confirmDeactivateClient() {
    const client = this.clientToDelete();
    if (!client) return;

    this.setStateMutation.mutate(
      { id: client.id, state: 'Inactivo' },
      {
        onSuccess: () => {
          this.alertService.toast('Cliente desactivado', 'success');
          this.clientToDelete.set(null);
        },
      },
    );
  }

  reactivateClient(client: IApiClient) {
    this.setStateMutation.mutate(
      { id: client.id, state: 'Activo' },
      {
        onSuccess: () => {
          this.alertService.toast('Cliente reactivado', 'success');
        },
      },
    );
  }
}
